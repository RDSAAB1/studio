import { doc, getDocs, writeBatch, getDoc, deleteDoc } from "firebase/firestore";
import { firestoreDB } from "../firebase";
import { db } from "../database";
import { isSqliteMode } from "../sqlite-storage";
import { getTenantCollectionPath } from "../tenancy";
import { withCreateMetadata, withEditMetadata, logActivity, moveToRecycleBin } from "../audit";
import { loansCollection, createLocalSubscription } from "./core";
import { Loan } from "@/lib/definitions";

export async function getAllLoans(): Promise<Loan[]> {
    if (isSqliteMode() && db) return db.loans.toArray();
    const snapshot = await getDocs(loansCollection);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Loan));
}

export function getLoansRealtime(
    callback: (data: Loan[]) => void,
    onError: (error: Error) => void
): () => void {
    return createLocalSubscription<Loan>("loans", callback);
}

export async function addLoan(loanData: Omit<Loan, 'id'>): Promise<Loan> {
    const batch = writeBatch(firestoreDB);
    const newDocRef = doc(loansCollection);
    const data = withCreateMetadata({ ...loanData, updatedAt: new Date().toISOString() } as Record<string, unknown>);
    batch.set(newDocRef, data);
    const { notifySyncRegistry } = await import('../sync-registry');
    await notifySyncRegistry('loans', { batch });
    await batch.commit();
    logActivity({ type: "create", collection: "loans", docId: newDocRef.id, docPath: getTenantCollectionPath("loans").join("/"), summary: `Created loan ${loanData.loanName}`, afterData: data }).catch(() => {});
    return { id: newDocRef.id, ...data } as Loan;
}

export async function updateLoan(id: string, loanData: Partial<Loan>): Promise<void> {
    const batch = writeBatch(firestoreDB);
    const docRef = doc(loansCollection, id);
    const data = withEditMetadata({ ...loanData, updatedAt: new Date().toISOString() } as Record<string, unknown>);
    batch.update(docRef, data);
    const { notifySyncRegistry } = await import('../sync-registry');
    await notifySyncRegistry('loans', { batch });
    await batch.commit();
    logActivity({ type: "edit", collection: "loans", docId: id, docPath: getTenantCollectionPath("loans").join("/"), summary: `Updated loan ${id}`, afterData: data }).catch(() => {});
}

export async function deleteLoan(id: string): Promise<void> {
    const docRef = doc(loansCollection, id);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      await moveToRecycleBin({ collection: "loans", docId: id, docPath: getTenantCollectionPath("loans").join("/"), data: { id: snap.id, ...snap.data() } as Record<string, unknown>, summary: `Deleted loan ${id}` });
    }
    const batch = writeBatch(firestoreDB);
    batch.delete(docRef);
    const { notifySyncRegistry } = await import('../sync-registry');
    await notifySyncRegistry('loans', { batch });
    await batch.commit();
}
