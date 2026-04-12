import { doc, getDoc, getDocs, writeBatch, collection } from "firebase/firestore";
import { firestoreDB } from "../firebase";
import { db } from "../database";
import { isSqliteMode } from "../sqlite-storage";
import { getTenantCollectionPath } from "../tenancy";
import { withCreateMetadata, withEditMetadata, logActivity, moveToRecycleBin } from "../audit";
import { 
  kantaParchiCollection, 
  customerDocumentsCollection,
  mandiReportsCollection,
  createLocalSubscription,
  handleSilentError,
  stripUndefined
} from "./core";
import { KantaParchi, CustomerDocument, MandiReport } from "@/lib/definitions";
import { createMetadataBasedListener } from "../sync-registry-listener";

// --- Kanta Parchi Functions ---
export async function addKantaParchi(kantaParchiData: KantaParchi): Promise<KantaParchi> {
    const batch = writeBatch(firestoreDB);
    const docRef = doc(kantaParchiCollection, kantaParchiData.srNo);
    const base = { ...kantaParchiData, createdAt: kantaParchiData.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
    const dataWithTimestamp = withCreateMetadata(base as Record<string, unknown>);
    batch.set(docRef, dataWithTimestamp);
    const { notifySyncRegistry } = await import('../sync-registry');
    await notifySyncRegistry('kantaParchi', { batch });
    await batch.commit();
    logActivity({ type: "create", collection: "kantaParchi", docId: kantaParchiData.srNo, docPath: getTenantCollectionPath("kantaParchi").join("/"), summary: `Created kanta parchi ${kantaParchiData.srNo}`, afterData: dataWithTimestamp as Record<string, unknown> }).catch(() => {});
    return dataWithTimestamp as KantaParchi;
}

export async function updateKantaParchi(srNo: string, updates: Partial<Omit<KantaParchi, 'id' | 'srNo'>>): Promise<boolean> {
    if (!srNo) return false;
    const docRef = doc(kantaParchiCollection, srNo);
    const data = withEditMetadata(stripUndefined({ ...updates, updatedAt: new Date().toISOString() } as Record<string, unknown>));
    if (!isSqliteMode()) {
        try {
            const batch = writeBatch(firestoreDB);
            batch.set(docRef, data, { merge: true });
            const { notifySyncRegistry } = await import('../sync-registry');
            await notifySyncRegistry('kantaParchi', { batch });
            await batch.commit();
        } catch (error) {
            handleSilentError(error, `updateKantaParchi Firestore sync - id: ${srNo}`);
        }
    }
    logActivity({ type: "edit", collection: "kantaParchi", docId: srNo, docPath: getTenantCollectionPath("kantaParchi").join("/"), summary: `Updated kanta parchi ${srNo}`, afterData: data }).catch(() => {});
    return true;
}

export async function deleteKantaParchi(srNo: string): Promise<void> {
    if (!srNo) return;
    const docRef = doc(kantaParchiCollection, srNo);
    const snap = await getDoc(docRef);
    const fullData = snap.exists() ? { id: snap.id, ...snap.data() } : null;
    if (fullData) {
      await moveToRecycleBin({ collection: "kantaParchi", docId: srNo, docPath: getTenantCollectionPath("kantaParchi").join("/"), data: fullData as Record<string, unknown>, summary: `Deleted kanta parchi ${srNo}` });
    }
    if (!isSqliteMode()) {
        const batch = writeBatch(firestoreDB);
        batch.delete(docRef);
        const { notifySyncRegistry } = await import('../sync-registry');
        await notifySyncRegistry('kantaParchi', { batch });
        await batch.commit();
    }
}

export async function getKantaParchiBySrNo(srNo: string): Promise<KantaParchi | null> {
    const docRef = doc(kantaParchiCollection, srNo);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as KantaParchi;
    }
    return null;
}

export function getKantaParchiRealtime(callback: (kantaParchi: KantaParchi[]) => void, onError: (error: Error) => void): () => void {
    return createLocalSubscription<KantaParchi>("kantaParchi", callback);
}

// --- Customer Document Functions ---
export async function addCustomerDocument(documentData: CustomerDocument): Promise<CustomerDocument> {
    const batch = writeBatch(firestoreDB);
    const docRef = doc(customerDocumentsCollection, documentData.documentSrNo);
    const base = { ...documentData, createdAt: documentData.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
    const dataWithTimestamp = withCreateMetadata(base as Record<string, unknown>);
    batch.set(docRef, dataWithTimestamp);
    const { notifySyncRegistry } = await import('../sync-registry');
    await notifySyncRegistry('customerDocuments', { batch });
    await batch.commit();
    logActivity({ type: "create", collection: "customerDocuments", docId: documentData.documentSrNo, docPath: getTenantCollectionPath("customerDocuments").join("/"), summary: `Created customer document ${documentData.documentSrNo}`, afterData: dataWithTimestamp as Record<string, unknown> }).catch(() => {});
    return dataWithTimestamp as CustomerDocument;
}

export async function updateCustomerDocument(documentSrNo: string, updates: Partial<Omit<CustomerDocument, 'id' | 'documentSrNo' | 'kantaParchiSrNo'>>): Promise<boolean> {
    if (!documentSrNo) return false;
    const docRef = doc(customerDocumentsCollection, documentSrNo);
    const data = withEditMetadata(stripUndefined({ ...updates, updatedAt: new Date().toISOString() } as Record<string, unknown>));
    if (!isSqliteMode()) {
        try {
            const batch = writeBatch(firestoreDB);
            batch.set(docRef, data, { merge: true });
            const { notifySyncRegistry } = await import('../sync-registry');
            await notifySyncRegistry('customerDocuments', { batch });
            await batch.commit();
        } catch (error) {
            handleSilentError(error, `updateCustomerDocument Firestore sync - id: ${documentSrNo}`);
        }
    }
    logActivity({ type: "edit", collection: "customerDocuments", docId: documentSrNo, docPath: getTenantCollectionPath("customerDocuments").join("/"), summary: `Updated customer document ${documentSrNo}`, afterData: data }).catch(() => {});
    return true;
}

export async function deleteCustomerDocument(documentSrNo: string): Promise<void> {
    if (!documentSrNo) return;
    const docRef = doc(customerDocumentsCollection, documentSrNo);
    const snap = await getDoc(docRef);
    const fullData = snap.exists() ? { id: snap.id, ...snap.data() } : null;
    if (fullData) {
      await moveToRecycleBin({ collection: "customerDocuments", docId: documentSrNo, docPath: getTenantCollectionPath("customerDocuments").join("/"), data: fullData as Record<string, unknown>, summary: `Deleted customer document ${documentSrNo}` });
    }
    if (!isSqliteMode()) {
        const batch = writeBatch(firestoreDB);
        batch.delete(docRef);
        const { notifySyncRegistry } = await import('../sync-registry');
        await notifySyncRegistry('customerDocuments', { batch });
        await batch.commit();
    }
}

export async function getCustomerDocumentBySrNo(documentSrNo: string): Promise<CustomerDocument | null> {
    const docRef = doc(customerDocumentsCollection, documentSrNo);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as CustomerDocument;
    }
    return null;
}

export function getCustomerDocumentsByKantaParchiSrNo(kantaParchiSrNo: string, callback: (documents: CustomerDocument[]) => void, onError: (error: Error) => void): () => void {
    return createLocalSubscription<CustomerDocument>(
        "customerDocuments",
        callback,
        (docs) => docs.filter((d: any) => d.kantaParchiSrNo === kantaParchiSrNo).sort((a: any, b: any) => (b.date || '').localeCompare(a.date || ''))
    );
}

export function getCustomerDocumentsRealtime(callback: (documents: CustomerDocument[]) => void, onError: (error: Error) => void): () => void {
    return createLocalSubscription<CustomerDocument>("customerDocuments", callback);
}

export async function getAllKantaParchi(): Promise<KantaParchi[]> {
  if (isSqliteMode() && db) {
    return db.kantaParchi.toArray();
  }
  const snapshot = await getDocs(kantaParchiCollection);
  return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as KantaParchi));
}

export async function getAllCustomerDocuments(): Promise<CustomerDocument[]> {
  if (isSqliteMode() && db) {
    return db.customerDocuments.toArray();
  }
  const snapshot = await getDocs(customerDocumentsCollection);
  return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as CustomerDocument));
}

// --- Mandi Report Functions ---

export async function addMandiReport(report: MandiReport): Promise<MandiReport> {
    if (!report.id) {
        throw new Error("MandiReport requires a valid id");
    }
    const { stripUndefined } = await import('./core');
    const timestamp = new Date().toISOString();
    const payload = stripUndefined<MandiReport>({
        ...report,
        createdAt: report.createdAt || timestamp,
        updatedAt: timestamp,
    });
    
    try {
        const { setDoc } = await import('firebase/firestore');
        const docRef = doc(mandiReportsCollection, payload.id);
        await setDoc(docRef, payload, { merge: true });
    } catch (error: unknown) {
        throw error;
    }
    
    if (db) {
        try {
            await db.mandiReports.put(payload);
        } catch (error) {}
    }
    return payload;
}

export async function updateMandiReport(id: string, updates: Partial<MandiReport>): Promise<void> {
    if (!id) throw new Error("updateMandiReport requires an id");
    const { stripUndefined } = await import('./core');
    const { setDoc } = await import('firebase/firestore');
    const docRef = doc(mandiReportsCollection, id);
    const updatePayload = stripUndefined<Partial<MandiReport>>({
        ...updates,
        updatedAt: new Date().toISOString(),
    });
    
    try {
        await setDoc(docRef, updatePayload, { merge: true });
    } catch (error) {
        throw error;
    }
    
    if (db) {
        try {
            const existing = await db.mandiReports.get(id);
            await db.mandiReports.put({
                ...(existing || { id }),
                ...updates,
                voucherNo: (updates.voucherNo ?? existing?.voucherNo ?? ""),
                updatedAt: updatePayload.updatedAt,
            } as MandiReport);
        } catch (error) {}
    }
}

export async function deleteMandiReport(id: string): Promise<void> {
    if (!id) return;
    const { deleteDoc } = await import('firebase/firestore');
    const docRef = doc(mandiReportsCollection, id);
    await deleteDoc(docRef);
    if (db) await db.mandiReports.delete(id);
}

export async function fetchMandiReports(forceFromFirestore = false): Promise<MandiReport[]> {
    const { handleSilentError } = await import('./core');
    if (!forceFromFirestore && db) {
        try {
            const localReports = await db.mandiReports.toArray();
            if (localReports.length > 0) return localReports;
        } catch (error) {
            handleSilentError(error, 'getAllMandiReports - local read fallback');
        }
    }

    const reportMap = new Map<string, MandiReport>();
    try {
        const parentDocsSnapshot = await getDocs(mandiReportsCollection);
        for (const parentDoc of parentDocsSnapshot.docs) {
            try {
                const subcollectionRef = collection(parentDoc.ref, '6P');
                const subcollectionSnapshot = await getDocs(subcollectionRef);
                subcollectionSnapshot.docs.forEach((docSnap) => {
                    const data = docSnap.data() as MandiReport;
                    const finalId = data.id || docSnap.id;
                    if (!reportMap.has(finalId)) reportMap.set(finalId, { ...data, id: finalId });
                });
            } catch (error) {}
        }
        
        const directSnapshot = await getDocs(mandiReportsCollection);
        directSnapshot.docs.forEach((docSnap) => {
            const data = docSnap.data() as MandiReport;
            if (data.voucherNo || data.sellerName) {
                const finalId = data.id || docSnap.id;
                if (!reportMap.has(finalId)) reportMap.set(finalId, { ...data, id: finalId });
            }
        });
    } catch (error) {}
    
    const allReports = Array.from(reportMap.values()).sort((a, b) => {
        const dateA = a.purchaseDate ? new Date(a.purchaseDate).getTime() : 0;
        const dateB = b.purchaseDate ? new Date(b.purchaseDate).getTime() : 0;
        return dateB - dateA;
    });
    
    if (db && allReports.length > 0) {
        try { await db.mandiReports.bulkPut(allReports); } catch (error) {}
    }
    return allReports;
}

export function getMandiReportsRealtime(callback: (data: MandiReport[]) => void, onError: (error: Error) => void) {
    return createLocalSubscription<MandiReport>("mandiReports", callback);
}

function chunkArray<T>(items: T[], size: number): T[][] {
    const result: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
        result.push(items.slice(i, i + size));
    }
    return result;
}

export async function bulkUpsertMandiReports(reports: MandiReport[], chunkSize = 400) {
    if (!isSqliteMode()) {
        const chunks = chunkArray(reports, chunkSize);
        for (const chunk of chunks) {
            const batch = writeBatch(firestoreDB);
            chunk.forEach((report) => {
                if (!report.id) throw new Error("Mandi report entry missing id");
                const ref = doc(mandiReportsCollection, report.id);
                batch.set(ref, report, { merge: true });
            });
            const { notifySyncRegistry } = await import('../sync-registry');
            await notifySyncRegistry('mandiReports', { batch });
            await batch.commit();
        }
    }
}
