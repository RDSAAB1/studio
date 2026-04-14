import { doc, getDoc, getDocs, query, orderBy, limit, writeBatch, deleteDoc, collection } from "firebase/firestore";
import { firestoreDB } from "../firebase";
import { db } from "../database";
import { isSqliteMode } from "../sqlite-storage";
import { retryFirestoreOperation } from "../retry-utils";
import { getTenantCollectionPath, getTenantDocPath } from "../tenancy";
import { withCreateMetadata, withEditMetadata, logActivity, moveToRecycleBin } from "../audit";
import { logError } from "../error-logger";
import { generateReadableId } from "../utils";
import { 
  fundTransactionsCollection, 
  incomesCollection, 
  expensesCollection, 
  supplierPaymentsCollection, 
  customerPaymentsCollection,
  handleSilentError,
  stripUndefined,
  createLocalSubscription
} from "./core";
import { FundTransaction, Income, Expense, CustomerPayment, PaidFor, IncomeCategory, ExpenseCategory, Payment } from "@/lib/definitions";
import { getRtgsSettings, updateRtgsSettings, getFormatSettings } from "./settings";
import { createMetadataBasedListener } from "../sync-registry-listener";

// --- Fund Transaction Functions ---
export async function addFundTransaction(transactionData: Omit<FundTransaction, 'id' | 'transactionId'> & { date?: string }): Promise<FundTransaction> {
  const finalDate = transactionData.date || new Date().toISOString();
  const dataWithDate = withCreateMetadata({ 
    ...transactionData, 
    date: finalDate, 
    updatedAt: new Date().toISOString() 
  } as Record<string, unknown>);
  const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `ft-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const saved = { id, transactionId: '', ...dataWithDate, date: finalDate } as FundTransaction;
  if (!isSqliteMode()) {
    try {
      const batch = writeBatch(firestoreDB);
      const docRef = doc(fundTransactionsCollection, id);
      batch.set(docRef, dataWithDate);
      const { notifySyncRegistry } = await import('../sync-registry');
      await notifySyncRegistry('fundTransactions', { batch });
      await batch.commit();
      logActivity({ type: "create", collection: "fundTransactions", docId: id, docPath: getTenantCollectionPath("fundTransactions").join("/"), summary: `Created fund transaction ${id}`, afterData: dataWithDate as Record<string, unknown> }).catch(() => {});
    } catch {
      // Firestore failed (e.g. local folder mode)
    }
  }
  if (typeof window !== 'undefined' && db) {
    try {
      const { isLocalFolderMode, mergeRecordToFolderFile } = await import('@/lib/local-folder-storage').catch(() => ({ isLocalFolderMode: () => false, mergeRecordToFolderFile: async () => false }));
      if (isLocalFolderMode()) await mergeRecordToFolderFile('fundTransactions', saved as unknown as Record<string, unknown>, 'id').catch(() => {});
      await db.fundTransactions.put(saved);
      window.dispatchEvent(new CustomEvent('indexeddb:collection:changed', { detail: { collection: 'fundTransactions' } }));
    } catch { /* ignore */ }
  }
  return saved;
}

export async function updateFundTransaction(id: string, data: Partial<FundTransaction>): Promise<void> {
    const updateData = withEditMetadata({ ...data, updatedAt: new Date().toISOString() } as Record<string, unknown>);
    if (!isSqliteMode()) {
        try {
          const batch = writeBatch(firestoreDB);
          const docRef = doc(fundTransactionsCollection, id);
          batch.update(docRef, updateData as any);
          const { notifySyncRegistry } = await import('../sync-registry');
          await notifySyncRegistry('fundTransactions', { batch });
          await batch.commit();
          logActivity({ type: "edit", collection: "fundTransactions", docId: id, docPath: getTenantCollectionPath("fundTransactions").join("/"), summary: `Updated fund transaction ${id}`, afterData: updateData as Record<string, unknown> }).catch(() => {});
        } catch { /* ignore */ }
    }
    if (typeof window !== 'undefined' && db) {
      try {
        const existing = await db.fundTransactions.get(id);
        if (existing) {
          const updated = { ...existing, ...data, updatedAt: (updateData as any).updatedAt };
          const { isLocalFolderMode, mergeRecordToFolderFile } = await import('@/lib/local-folder-storage').catch(() => ({ isLocalFolderMode: () => false, mergeRecordToFolderFile: async () => false }));
          if (isLocalFolderMode()) await mergeRecordToFolderFile('fundTransactions', updated as unknown as Record<string, unknown>, 'id').catch(() => {});
          await db.fundTransactions.put(updated);
          window.dispatchEvent(new CustomEvent('indexeddb:collection:changed', { detail: { collection: 'fundTransactions' } }));
        }
      } catch { /* ignore */ }
    }
}

export async function deleteFundTransaction(id: string): Promise<void> {
    if (!isSqliteMode()) {
        try {
          const docRef = doc(fundTransactionsCollection, id);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            await moveToRecycleBin({ collection: "fundTransactions", docId: id, docPath: getTenantCollectionPath("fundTransactions").join("/"), data: { id: snap.id, ...snap.data() } as Record<string, unknown>, summary: `Deleted fund transaction ${id}` });
          }
          const batch = writeBatch(firestoreDB);
          batch.delete(docRef);
          const { notifySyncRegistry } = await import('../sync-registry');
          await notifySyncRegistry('fundTransactions', { batch });
          await batch.commit();
        } catch { /* ignore */ }
    }
    if (typeof window !== 'undefined' && db) {
      try {
        const { isLocalFolderMode, removeRecordFromFolderFile } = await import('@/lib/local-folder-storage').catch(() => ({ isLocalFolderMode: () => false, removeRecordFromFolderFile: async () => false }));
        if (isLocalFolderMode()) await removeRecordFromFolderFile('fundTransactions', id, 'id').catch(() => {});
        await db.fundTransactions.delete(id);
        window.dispatchEvent(new CustomEvent('indexeddb:collection:changed', { detail: { collection: 'fundTransactions' } }));
      } catch { /* ignore */ }
    }
}

export function getFundTransactionsRealtime(
    callback: (data: FundTransaction[]) => void,
    onError: (error: Error) => void
): () => void {
    return createLocalSubscription<FundTransaction>("fundTransactions", callback);
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

        const docRef = doc(incomesCollection, newTransactionId);
        
        let idExists = false;
        try {
            if (isSqliteMode() && db) {
                const localIdx = await db.transactions.get(newTransactionId);
                if (localIdx) idExists = true;
            } else {
                const existingDoc = await getDoc(docRef);
                if (existingDoc.exists()) idExists = true;
            }
        } catch (_) {}
        
        if (idExists) {
            throw new Error(`Transaction ID ${newTransactionId} already exists!`);
        }
        
        const newIncome = withCreateMetadata(stripUndefined({ ...incomeData, transactionId: newTransactionId, id: docRef.id } as Record<string, unknown>));
        
        if (!isSqliteMode()) {
            const batch = writeBatch(firestoreDB);
            batch.set(docRef, newIncome);
            const { notifySyncRegistry } = await import('../sync-registry');
            await notifySyncRegistry('incomes', { batch });
            await retryFirestoreOperation(() => batch.commit(), 'addIncome - commit batch');
            logActivity({ type: "create", collection: "incomes", docId: newTransactionId, docPath: getTenantCollectionPath("incomes").join("/"), summary: `Created income ${newTransactionId}`, afterData: newIncome as Record<string, unknown> }).catch(() => {});
        }
        const saved = newIncome as Income;
        if (typeof window !== 'undefined' && db?.transactions) {
            try {
                const toSave = { ...saved, type: 'Income' as const, transactionType: 'Income' as const };
                await db.transactions.put(toSave);
                window.dispatchEvent(new CustomEvent('indexeddb:collection:changed', { detail: { collection: 'incomes' } }));
            } catch { /* ignore */ }
        }
        return saved;
    } catch (error) {
        logError(error, `addIncome(${incomeData.transactionId || 'new'})`, 'high');
        throw error;
    }
}

export async function addExpense(expenseData: Omit<Expense, 'id'>): Promise<Expense> {
    const formatSettings = await getFormatSettings();
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
    
    const docRef = doc(expensesCollection, newTransactionId);
    let idExists = false;
    try {
        if (isSqliteMode() && db) {
            const localIdx = await db.transactions.get(newTransactionId);
            if (localIdx) idExists = true;
        } else {
            const existingDoc = await getDoc(docRef);
            if (existingDoc.exists()) idExists = true;
        }
    } catch (_) {}

    if (idExists) throw new Error(`Transaction ID ${newTransactionId} already exists!`);
    
    const newExpense = withCreateMetadata(stripUndefined({ ...expenseData, transactionId: newTransactionId, id: docRef.id } as Record<string, unknown>));
    
    if (!isSqliteMode()) {
        const batch = writeBatch(firestoreDB);
        batch.set(docRef, newExpense);
        const { notifySyncRegistry } = await import('../sync-registry');
        await notifySyncRegistry('expenses', { batch });
        await batch.commit();
        logActivity({ type: "create", collection: "expenses", docId: newTransactionId, docPath: getTenantCollectionPath("expenses").join("/"), summary: `Created expense ${newTransactionId}`, afterData: newExpense as Record<string, unknown> }).catch(() => {});
    }
    const saved = newExpense as Expense;
    if (typeof window !== 'undefined' && db?.transactions) {
        try {
            const toSave = { ...saved, type: 'Expense' as const, transactionType: 'Expense' as const };
            await db.transactions.put(toSave);
            window.dispatchEvent(new CustomEvent('indexeddb:collection:changed', { detail: { collection: 'expenses' } }));
        } catch { /* ignore */ }
    }
    return saved;
}

export async function updateIncome(id: string, incomeData: Partial<Omit<Income, 'id'>>): Promise<void> {
    const data = withEditMetadata(stripUndefined({ ...incomeData, updatedAt: new Date().toISOString() } as Record<string, unknown>));
    if (!isSqliteMode()) {
        try {
            const batch = writeBatch(firestoreDB);
            batch.set(doc(incomesCollection, id), data, { merge: true });
            const { notifySyncRegistry } = await import('../sync-registry');
            await notifySyncRegistry('incomes', { batch });
            await batch.commit();
            logActivity({ type: "edit", collection: "incomes", docId: id, docPath: getTenantCollectionPath("incomes").join("/"), summary: `Updated income ${id}`, afterData: data as Record<string, unknown> }).catch(() => {});
        } catch (error) {
            handleSilentError(error, `updateIncome Firestore sync - id: ${id}`);
        }
    }

    if (db && db.transactions) {
        try {
            await db.transactions.update(id, { ...incomeData, updatedAt: (data as any).updatedAt });
            window.dispatchEvent(new CustomEvent('indexeddb:collection:changed', { detail: { collection: 'incomes' } }));
        } catch (error) {
            handleSilentError(error, 'updateIncome - local optimistic update');
        }
    }
}

export async function updateExpense(id: string, expenseData: Partial<Omit<Expense, 'id'>>): Promise<void> {
    const data = withEditMetadata(stripUndefined({ ...expenseData, updatedAt: new Date().toISOString() } as Record<string, unknown>));
    if (!isSqliteMode()) {
        try {
            const batch = writeBatch(firestoreDB);
            batch.set(doc(expensesCollection, id), data, { merge: true });
            const { notifySyncRegistry } = await import('../sync-registry');
            await notifySyncRegistry('expenses', { batch });
            await batch.commit();
            logActivity({ type: "edit", collection: "expenses", docId: id, docPath: getTenantCollectionPath("expenses").join("/"), summary: `Updated expense ${id}`, afterData: data as Record<string, unknown> }).catch(() => {});
        } catch (error) {
            handleSilentError(error, `updateExpense Firestore sync - id: ${id}`);
        }
    }
    
    if (db && db.transactions) {
        try {
            await db.transactions.update(id, { ...expenseData, updatedAt: (data as any).updatedAt });
            window.dispatchEvent(new CustomEvent('indexeddb:collection:changed', { detail: { collection: 'expenses' } }));
        } catch (error) {
            handleSilentError(error, 'updateExpense - local optimistic update');
        }
    }
}

export async function deleteIncome(id: string): Promise<void> {
    if (!isSqliteMode()) {
        try {
            const docRef = doc(incomesCollection, id);
            const snap = await getDoc(docRef);
            if (snap.exists()) {
              await moveToRecycleBin({ collection: "incomes", docId: id, docPath: getTenantCollectionPath("incomes").join("/"), data: { id: snap.id, ...snap.data() } as Record<string, unknown>, summary: `Deleted income ${id}` });
            }
            const batch = writeBatch(firestoreDB);
            batch.delete(docRef);
            const { notifySyncRegistry } = await import('../sync-registry');
            await notifySyncRegistry('incomes', { batch });
            await batch.commit();
        } catch { /* ignore */ }
    }

    if (typeof window !== 'undefined' && db?.transactions) {
        try {
            await db.transactions.delete(id);
            window.dispatchEvent(new CustomEvent('indexeddb:collection:changed', { detail: { collection: 'incomes' } }));
        } catch { /* ignore */ }
    }
}

export async function deleteExpense(id: string): Promise<void> {
    if (!isSqliteMode()) {
        try {
            const docRef = doc(expensesCollection, id);
            const snap = await getDoc(docRef);
            if (snap.exists()) {
              await moveToRecycleBin({ collection: "expenses", docId: id, docPath: getTenantCollectionPath("expenses").join("/"), data: { id: snap.id, ...snap.data() } as Record<string, unknown>, summary: `Deleted expense ${id}` });
            }
            const batch = writeBatch(firestoreDB);
            batch.delete(docRef);
            const { notifySyncRegistry } = await import('../sync-registry');
            await notifySyncRegistry('expenses', { batch });
            await batch.commit();
        } catch { /* ignore */ }
    }

    if (typeof window !== 'undefined' && db?.transactions) {
        try {
            await db.transactions.delete(id);
            window.dispatchEvent(new CustomEvent('indexeddb:collection:changed', { detail: { collection: 'expenses' } }));
        } catch { /* ignore */ }
    }
}

export function getIncomesRealtime(
    callback: (data: Income[]) => void,
    onError: (error: Error) => void
): () => void {
    return createLocalSubscription<Income>("transactions", callback, (entries) => entries.filter(e => e.transactionType === 'Income'));
}

export function getExpensesRealtime(
    callback: (data: Expense[]) => void,
    onError: (error: Error) => void
): () => void {
    return createLocalSubscription<Expense>("transactions", callback, (entries) => entries.filter(e => e.transactionType === 'Expense'));
}

export function getIncomeRealtime(
    callback: (data: Income[]) => void,
    onError: (error: Error) => void
): () => void {
    return getIncomesRealtime(callback, onError);
}

// --- Payment Related Deletions ---
export async function deletePaymentsForSrNo(srNo: string): Promise<void> {
  if (!srNo) return;
  const paymentIdsToDelete: string[] = [];
  if (db) {
    const allPayments = await db.payments.toArray();
    const paymentIdsToRemoveFromFile: string[] = [];
    for (const payment of allPayments) {
      if (payment.paidFor && Array.isArray(payment.paidFor)) {
        if (payment.paidFor.some((pf: PaidFor) => pf.srNo === srNo)) {
          paymentIdsToDelete.push(payment.id);
          paymentIdsToRemoveFromFile.push(String((payment as any).paymentId ?? payment.id).trim());
        }
      }
    }
    const { isLocalFolderMode, removePaymentsFromFolderFile } = await import('@/lib/local-folder-storage').catch(() => ({ isLocalFolderMode: () => false, removePaymentsFromFolderFile: async () => false }));
    if (isLocalFolderMode() && paymentIdsToRemoveFromFile.length > 0) {
      await removePaymentsFromFolderFile('payments', paymentIdsToRemoveFromFile).catch(() => {});
    }
    if (paymentIdsToDelete.length > 0) await db.payments.bulkDelete(paymentIdsToDelete);
  }
  if (paymentIdsToDelete.length > 0) {
    const { enqueueSyncTask } = await import('../sync-queue');
    for (const paymentId of paymentIdsToDelete) {
      await enqueueSyncTask('delete:payment', { id: paymentId }, { attemptImmediate: true, dedupeKey: `delete:payment:${paymentId}` });
    }
  }
}

export async function deleteAllPayments(): Promise<void> {
    if (!isSqliteMode()) {
        const snapshot = await getDocs(supplierPaymentsCollection);
        const batch = writeBatch(firestoreDB);
        snapshot.forEach(docSnap => batch.delete(docSnap.ref));
        await batch.commit();
    }
    if (db) await db.payments.clear();
}

export async function bulkUpsertPayments(payments: Payment[], chunkSize = 400) {
    if (!payments.length) return;
    const { chunkArray } = await import('./suppliers');
    const chunks = chunkArray(payments, chunkSize);
    for (const chunk of chunks) {
        const batch = writeBatch(firestoreDB);
        chunk.forEach((payment) => {
            if (!payment.id) throw new Error("Payment missing id");
            const ref = doc(supplierPaymentsCollection, payment.id);
            batch.set(ref, payment, { merge: true });
        });
        const { notifySyncRegistry } = await import('../sync-registry');
        if (!isSqliteMode()) {
            await notifySyncRegistry('payments', { batch });
            await batch.commit();
        }
    }
}

export async function deleteCustomerPaymentsForSrNo(srNo: string): Promise<void> {
  if (!srNo) return;
  const paymentIdsToDelete: string[] = [];
  if (db) {
    const allPayments = await db.customerPayments.toArray();
    const paymentIdsToRemoveFromFile: string[] = [];
    for (const payment of allPayments) {
      if (payment.paidFor && Array.isArray(payment.paidFor)) {
        if (payment.paidFor.some((pf: PaidFor) => pf.srNo === srNo)) {
          paymentIdsToDelete.push(payment.id);
          paymentIdsToRemoveFromFile.push(String((payment as any).paymentId ?? payment.id).trim());
        }
      }
    }
    const { isLocalFolderMode, removePaymentsFromFolderFile } = await import('@/lib/local-folder-storage').catch(() => ({ isLocalFolderMode: () => false, removePaymentsFromFolderFile: async () => false }));
    if (isLocalFolderMode() && paymentIdsToRemoveFromFile.length > 0) {
      await removePaymentsFromFolderFile('customerPayments', paymentIdsToRemoveFromFile).catch(() => {});
    }
    if (paymentIdsToDelete.length > 0) await db.customerPayments.bulkDelete(paymentIdsToDelete);
  }
  if (paymentIdsToDelete.length > 0) {
    const { enqueueSyncTask } = await import('../sync-queue');
    for (const paymentId of paymentIdsToDelete) {
      await enqueueSyncTask('delete:customerPayment', { id: paymentId }, { attemptImmediate: true, dedupeKey: `delete:customerPayment:${paymentId}` });
    }
  }
}

export async function addCustomerPayment(paymentData: Omit<CustomerPayment, 'id'>): Promise<CustomerPayment> {
    const { writeLocalFirst } = await import('../local-first-sync');
    const docRef = doc(customerPaymentsCollection, paymentData.paymentId);
    const newPayment = withCreateMetadata({ ...paymentData, id: docRef.id } as Record<string, unknown>) as CustomerPayment & { id: string };
    await writeLocalFirst('customerPayments', 'create', docRef.id, newPayment);
    logActivity({ type: "create", collection: "customer_payments", docId: docRef.id, docPath: getTenantCollectionPath("customer_payments").join("/"), summary: `Created customer payment ${docRef.id}`, afterData: newPayment as Record<string, unknown> }).catch(() => {});
    return newPayment as CustomerPayment;
}

export async function deleteCustomerPayment(id: string): Promise<void> {
    const docRef = doc(customerPaymentsCollection, id);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      await moveToRecycleBin({ collection: "customer_payments", docId: id, docPath: getTenantCollectionPath("customer_payments").join("/"), data: { id: snap.id, ...snap.data() } as Record<string, unknown>, summary: `Deleted customer payment ${id}` });
    }
    if (!isSqliteMode()) {
      await deleteDoc(docRef);
      const { notifySyncRegistry } = await import('../sync-registry');
      await notifySyncRegistry('customerPayments');
    }
    if (typeof window !== 'undefined' && db) {
      const { isLocalFolderMode, removePaymentsFromFolderFile } = await import('@/lib/local-folder-storage').catch(() => ({ isLocalFolderMode: () => false, removePaymentsFromFolderFile: async () => false }));
      if (isLocalFolderMode()) await removePaymentsFromFolderFile('customerPayments', [id]).catch(() => {});
      await db.customerPayments.delete(id);
      await db.customerPayments.where('paymentId').equals(id).delete();
      window.dispatchEvent(new CustomEvent('indexeddb:collection:changed', { detail: { collection: 'customerPayments' } }));
    }
}

export async function getAllIncomes(): Promise<Income[]> {
    if (isSqliteMode() && db) {
        return db.transactions.where('transactionType').equals('Income').toArray() as Promise<Income[]>;
    }
    const snapshot = await getDocs(incomesCollection);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Income));
}

export async function getAllExpenses(): Promise<Expense[]> {
    if (isSqliteMode() && db) {
        return db.transactions.where('transactionType').equals('Expense').toArray() as Promise<Expense[]>;
    }
    const snapshot = await getDocs(expensesCollection);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Expense));
}

export async function getAllFundTransactions(): Promise<FundTransaction[]> {
    if (isSqliteMode() && db) return db.fundTransactions.toArray();
    const snapshot = await getDocs(fundTransactionsCollection);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FundTransaction));
}

export async function getAllPayments(): Promise<Payment[]> {
    if (isSqliteMode() && db) {
        return db.payments.toArray() as Promise<Payment[]>;
    }
    const snapshot = await getDocs(supplierPaymentsCollection);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Payment));
}

export async function getTotalExpenseCount(): Promise<number> {
    if (isSqliteMode() && db) {
        return db.transactions.where('transactionType').equals('Expense').count();
    }
    const snapshot = await getDocs(expensesCollection);
    return snapshot.size;
}

export function getPaymentsRealtime(
    callback: (data: Payment[]) => void,
    onError: (error: Error) => void
): () => void {
    return createLocalSubscription<Payment>("payments", callback);
}

export function getCustomerPaymentsRealtime(
    callback: (data: CustomerPayment[]) => void,
    onError: (error: Error) => void
): () => void {
    return createLocalSubscription<CustomerPayment>("customerPayments", callback);
}

export async function getAllCustomerPayments(): Promise<CustomerPayment[]> {
    const electron = (window as any).electron;
    if (electron?.sqliteQuery) return electron.sqliteQuery('customerPayments');
    const snapshot = await getDocs(customerPaymentsCollection);
    return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as CustomerPayment));
}

export async function bulkUpsertCustomerPayments(payments: CustomerPayment[], chunkSize = 400) {
    if (!payments.length) return;
    const { chunkArray } = await import('./suppliers');
    const chunks = chunkArray(payments, chunkSize);
    for (const chunk of chunks) {
        const batch = writeBatch(firestoreDB);
        chunk.forEach((payment) => {
            if (!payment.id) throw new Error("Customer Payment missing id");
            const ref = doc(customerPaymentsCollection, payment.id);
            batch.set(ref, payment, { merge: true });
        });
        const { notifySyncRegistry } = await import('../sync-registry');
        if (!isSqliteMode()) {
            await notifySyncRegistry('customerPayments', { batch });
            await batch.commit();
        }
    }
}

// --- Migration Functions ---
