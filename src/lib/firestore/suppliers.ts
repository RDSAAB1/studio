import { doc, getDoc, getDocs, query, where, writeBatch, increment, orderBy, limit, Timestamp, collection } from "firebase/firestore";
import { firestoreDB } from "../firebase";
import { db, getDb } from "../database";
import { isSqliteMode } from "../sqlite-storage";
import { getTenantCollectionPath, getTenantDocPath } from "../tenancy";
import { withCreateMetadata, logActivity, moveToRecycleBin } from "../audit";
import { logError } from "../error-logger";
import { calculateSupplierEntry } from "../utils";
import { suppliersCollection, supplierBankAccountsCollection, supplierPaymentsCollection, handleSilentError, createLocalSubscription } from "./core";
import { Customer, PaidFor, Payment } from "@/lib/definitions";
import { getHolidays, getDailyPaymentLimit } from "./settings";

export async function addSupplier(supplierData: Customer): Promise<Customer> {
    try {
        const dbRaw = getDb();
        
        // --- DUPLICATE SAFETY CHECK ---
        // If an entry with this srNo already exists, treat this as an update to prevent 2 entries.
        if (supplierData.srNo && supplierData.srNo.trim() !== '' && supplierData.srNo !== 'S----') {
            const srNoToMatch = supplierData.srNo.trim();
            // Now that sqlite:get supports 'srNo' column detection, this will work reliably
            const existing = await dbRaw.suppliers.where('srNo').equals(srNoToMatch).first();
            
            if (existing && existing.id) {
                console.log(`[addSupplier] Duplicate srNo ${srNoToMatch} found (ID: ${existing.id}). Merging into existing record.`);
                const targetId = existing.id;
                const { id: _, ...dataToUpdate } = supplierData;
                
                // Perform the update on the EXISTING record ID
                await updateSupplier(targetId, dataToUpdate);
                return { ...existing, ...dataToUpdate, id: targetId };
            }
        }

        const documentIdValue = supplierData.srNo && supplierData.srNo.trim() !== '' && supplierData.srNo !== 'S----' 
            ? supplierData.srNo 
            : supplierData.id;
        
        const supplierWithCorrectId = { ...supplierData, id: documentIdValue };
        
        const { writeLocalFirst } = await import('../local-first-sync');
        const result = await writeLocalFirst('suppliers', 'create', documentIdValue, supplierWithCorrectId) as Customer;
        
        const { isLocalFolderMode, mergeRecordToFolderFile } = await import('@/lib/local-folder-storage').catch(() => ({ isLocalFolderMode: () => false, mergeRecordToFolderFile: async () => false }));
        if (isLocalFolderMode() && result) void mergeRecordToFolderFile('suppliers', result as unknown as Record<string, unknown>, 'id').catch(() => {});
        
        if (typeof window !== 'undefined' && result) {
            window.dispatchEvent(new CustomEvent('indexeddb:supplier:updated', {
                detail: { supplier: result },
            }));
        }
        return result;
    } catch (error) {
        logError(error, `addSupplier(${supplierData.srNo || supplierData.id})`, 'high');
        throw error;
    }
}

export async function getSupplierIdBySrNo(srNo: string): Promise<string | null> {
  try {
    const q = query(suppliersCollection, where('srNo', '==', srNo));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs[0].id;
    }
    return null;
  } catch {
    return null;
  }
}

export async function updateSupplier(id: string, supplierData: Partial<Omit<Customer, 'id'>>): Promise<boolean> {
  if (!id) return false;
  if (!supplierData || Object.keys(supplierData).length === 0) return false;
  
  let oldSrNo: string | undefined;
  let newSrNo: string | undefined;
  
  if (supplierData.srNo && db) {
    const currentSupplier = await db.suppliers.get(id);
    if (currentSupplier) {
      oldSrNo = currentSupplier.srNo;
      newSrNo = supplierData.srNo;
      
      if (oldSrNo && newSrNo && oldSrNo !== newSrNo) {
        try {
          const allPayments = await db.payments.toArray();
          const affectedPayments = allPayments.filter(p => 
            p.paidFor?.some((pf: PaidFor) => pf.srNo === oldSrNo)
          );
          
          if (affectedPayments.length > 0) {
            for (const payment of affectedPayments) {
              if (payment.paidFor) {
                const updatedPaidFor = payment.paidFor.map((pf: PaidFor) => 
                  pf.srNo === oldSrNo ? { ...pf, srNo: newSrNo! } : pf
                );
                await db.payments.update(payment.id, {
                    paidFor: updatedPaidFor,
                    updatedAt: new Date().toISOString()
                } as any).catch(() => {});
              }
            }
            
            const { enqueueSyncTask } = await import('../sync-queue');
            for (const payment of affectedPayments) {
              if (payment.paidFor) {
                const updatedPaidFor = payment.paidFor.map((pf: PaidFor) => 
                  pf.srNo === oldSrNo ? { ...pf, srNo: newSrNo! } : pf
                );
                await enqueueSyncTask(
                  'update:payments',
                  { id: payment.id, changes: { paidFor: updatedPaidFor, updatedAt: new Date().toISOString() } },
                  { attemptImmediate: true, dedupeKey: `payments:${payment.id}` }
                ).catch(() => {});
              }
            }
          }
        } catch (error) {
          handleSilentError(error, 'updateSupplier - payment update');
        }
      }
    }
  }
  
  try {
    const { writeLocalFirst } = await import('../local-first-sync');
    await writeLocalFirst('suppliers', 'update', id, undefined, supplierData as Partial<Customer>);
    const { isLocalFolderMode, mergeRecordToFolderFile } = await import('@/lib/local-folder-storage').catch(() => ({ isLocalFolderMode: () => false, mergeRecordToFolderFile: async () => false }));
    
    let updatedSupplier: Customer | null = null;
    if (db) {
      updatedSupplier = await db.suppliers.get(id) as Customer | null;
    }
    if (isLocalFolderMode() && updatedSupplier) {
      void mergeRecordToFolderFile('suppliers', updatedSupplier as unknown as Record<string, unknown>, 'id').catch(() => {});
    }
    if (typeof window !== 'undefined' && updatedSupplier) {
      window.dispatchEvent(new CustomEvent('indexeddb:supplier:updated', {
        detail: { supplier: updatedSupplier },
      }));
    }
    return true;
  } catch (error) {
    return false;
  }
}

export async function deleteSupplier(id: string): Promise<void> {
  if (!id) return;

  try {
    let supplierData: Customer | null = null;
    let supplierSrNo: string | null = null;
    let documentIdV = id;
    
    if (db) {
      supplierData = (await db.suppliers.get(id)) || null;
      if (supplierData) {
        supplierSrNo = supplierData.srNo;
      } else {
        const allSuppliers = await db.suppliers.toArray();
        const foundBySrNo = allSuppliers.find(s => s.srNo === id);
        if (foundBySrNo) {
          supplierData = foundBySrNo;
          supplierSrNo = foundBySrNo.srNo;
        }
      }
    }
    
    let foundInFirestore = false;
    try {
      let docRef = await getDoc(doc(suppliersCollection, id));
      if (docRef.exists()) {
        documentIdV = id;
        foundInFirestore = true;
        if (!supplierData) {
          supplierData = docRef.data() as unknown as Customer | null;
          supplierSrNo = (supplierData as any)?.srNo;
        }
      } else if (supplierSrNo && supplierSrNo.trim() !== '' && supplierSrNo !== 'S----') {
        docRef = await getDoc(doc(suppliersCollection, supplierSrNo));
        if (docRef.exists()) {
          documentIdV = supplierSrNo;
          foundInFirestore = true;
          if (!supplierData) supplierData = docRef.data() as unknown as Customer | null;
        } else {
          const q = query(suppliersCollection, where('srNo', '==', supplierSrNo));
          const snap = await getDocs(q);
          if (!snap.empty) {
            documentIdV = snap.docs[0].id;
            foundInFirestore = true;
            if (!supplierData) supplierData = snap.docs[0].data() as unknown as Customer | null;
          } else {
            const q2 = query(suppliersCollection, where('srNo', '==', id));
            const snap2 = await getDocs(q2);
            if (!snap2.empty) {
              documentIdV = snap2.docs[0].id;
              foundInFirestore = true;
              if (!supplierData) {
                supplierData = snap2.docs[0].data() as unknown as Customer | null;
                supplierSrNo = (supplierData as any)?.srNo;
              }
            }
          }
        }
      }
    } catch (_) {}

    if (!supplierData) return;
    if (!foundInFirestore) {
      documentIdV = (supplierData as any)?.id ?? id;
    }
    if (!supplierSrNo && supplierData) {
      supplierSrNo = (supplierData as any)?.srNo;
    }
    
    const paymentsToDelete: string[] = [];
    const paymentIdsToRemoveFromFile: string[] = [];
    const paymentsToUpdate: Array<{ id: string; paidFor: PaidFor[]; amount: number }> = [];
    
    if (db) {
      const allPayments = await db.payments.toArray();
      for (const payment of allPayments) {
        if (payment.paidFor && Array.isArray(payment.paidFor)) {
          const matchingPaidFor = payment.paidFor.find((pf: PaidFor) => pf.srNo === supplierSrNo);
          if (matchingPaidFor) {
            if (payment.paidFor.length === 1) {
              paymentsToDelete.push(payment.id);
              paymentIdsToRemoveFromFile.push(String((payment as any).paymentId ?? payment.id).trim());
            } else {
              const updatedPaidFor = payment.paidFor.filter((pf: PaidFor) => pf.srNo !== supplierSrNo);
              const amountToDeduct = matchingPaidFor.amount || 0;
              paymentsToUpdate.push({
                id: payment.id,
                paidFor: updatedPaidFor,
                amount: payment.amount - amountToDeduct
              });
            }
          }
        }
      }
    }
    
    const { isLocalFolderMode, removePaymentsFromFolderFile, writePaymentToFolderFile, removeRecordFromFolderFile } = await import('@/lib/local-folder-storage').catch(() => ({ isLocalFolderMode: () => false, removePaymentsFromFolderFile: async () => false, writePaymentToFolderFile: async () => false, removeRecordFromFolderFile: async () => false }));
    if (isLocalFolderMode() && paymentIdsToRemoveFromFile.length > 0) {
      await removePaymentsFromFolderFile('payments', paymentIdsToRemoveFromFile).catch(() => {});
    }
    
    if (db && paymentsToDelete.length > 0) {
      await db.payments.bulkDelete(paymentsToDelete);
    }
    
    if (db && paymentsToUpdate.length > 0) {
      for (const paymentUpdate of paymentsToUpdate) {
        const existingPayment = await db.payments.get(paymentUpdate.id);
        if (existingPayment) {
          const updatedPayment = {
            ...existingPayment,
            paidFor: paymentUpdate.paidFor,
            amount: paymentUpdate.amount
          };
          if ('updatedAt' in existingPayment) {
            (updatedPayment as any).updatedAt = new Date().toISOString();
          }
          if (isLocalFolderMode()) await writePaymentToFolderFile('payments', updatedPayment as unknown as Record<string, unknown>).catch(() => {});
          await db.payments.put(updatedPayment);
        }
      }
    }
    
    if (typeof window !== 'undefined' && (paymentsToDelete.length > 0 || paymentsToUpdate.length > 0)) {
      window.dispatchEvent(new CustomEvent('indexeddb:collection:changed', { detail: { collection: 'payments' } }));
    }
    
    const idToDelete = (supplierData as any)?.id ?? documentIdV;
    if (typeof window !== 'undefined') {
      try {
        const dbRaw = getDb();
        await dbRaw.suppliers.delete(idToDelete);
        if (supplierSrNo != null && String(supplierSrNo).trim() !== '') {
          await dbRaw.suppliers.where('srNo').equals(supplierSrNo).delete();
        }
      } catch (e) {
        handleSilentError(e, 'deleteSupplier IndexedDB delete');
      }
      window.dispatchEvent(new CustomEvent('indexeddb:supplier:deleted', {
        detail: { id: idToDelete, srNo: supplierSrNo },
      }));
      window.dispatchEvent(new CustomEvent('indexeddb:collection:changed', { detail: { collection: 'suppliers' } }));
    }
    const { writeLocalFirst } = await import('../local-first-sync');
    await writeLocalFirst('suppliers', 'delete', documentIdV);

    if (isLocalFolderMode()) {
      await removeRecordFromFolderFile('suppliers', (supplierData as any)?.id ?? documentIdV, 'id').catch(() => {});
    }

    const { enqueueSyncTask } = await import('../sync-queue');
    if (paymentsToDelete.length > 0) {
      for (const paymentId of paymentsToDelete) {
        await enqueueSyncTask('delete:payment', { id: paymentId }, { 
          attemptImmediate: true, 
          dedupeKey: `delete:payment:${paymentId}` 
        });
      }
    }
    
    if (paymentsToUpdate.length > 0) {
      for (const paymentUpdate of paymentsToUpdate) {
        const existingPayment = await db?.payments.get(paymentUpdate.id);
        if (existingPayment) {
          await enqueueSyncTask('upsert:payment', {
            ...existingPayment,
            paidFor: paymentUpdate.paidFor,
            amount: paymentUpdate.amount
          }, { 
            attemptImmediate: true, 
            dedupeKey: `upsert:payment:${paymentUpdate.id}` 
          });
        }
      }
    }
    
  } catch (error) {
    throw error;
  }
}

export async function deleteMultipleSuppliers(supplierIds: string[]): Promise<void> {
    if (!supplierIds || supplierIds.length === 0) return;

    try {
        const paymentsToDeleteArr = new Set<string>();
        const paymentsToUpdateMap = new Map<string, { updatedPaidFor: any[], amountToDeduct: number }>();
        const validSupplierIds: string[] = [];
        const supplierSrNos: string[] = [];

        if (typeof window !== 'undefined' && db) {
            const localSuppliers = await db.suppliers.where('id').anyOf(supplierIds).toArray();
            localSuppliers.forEach(s => {
                validSupplierIds.push(s.id);
                if (s.srNo) supplierSrNos.push(s.srNo);
            });

            if (supplierSrNos.length > 0) {
                const allPayments = await db.payments.toArray();
                allPayments.forEach(payment => {
                    const affectedEntries = payment.paidFor?.filter((pf: any) => supplierSrNos.includes(pf.srNo)) || [];
                    if (affectedEntries.length > 0) {
                        if (payment.paidFor?.length === affectedEntries.length) {
                            paymentsToDeleteArr.add(payment.id);
                        } else {
                            const updatedPaidFor = payment.paidFor?.filter((pf: any) => !supplierSrNos.includes(pf.srNo)) || [];
                            const amountToDeduct = affectedEntries.reduce((sum: number, pf: any) => sum + (Number(pf.amount) || 0), 0);
                            paymentsToUpdateMap.set(payment.id, { updatedPaidFor, amountToDeduct });
                        }
                    }
                });
            }
        }

        const ops = [
            ...Array.from(paymentsToDeleteArr).map(pid => ({ type: 'delete', ref: doc(collection(firestoreDB, ...getTenantCollectionPath("payments")), pid) })),
            ...Array.from(paymentsToUpdateMap.entries()).map(([pid, info]) => ({ 
                type: 'update', 
                ref: doc(collection(firestoreDB, ...getTenantCollectionPath("payments")), pid), 
                data: { paidFor: info.updatedPaidFor, amount: increment(-info.amountToDeduct) } 
            })),
            ...validSupplierIds.map(sid => ({ type: 'delete', ref: doc(suppliersCollection, sid) }))
        ];

        for (let i = 0; i < ops.length; i += 450) {
            const batch = writeBatch(firestoreDB);
            const chunk = ops.slice(i, i + 450);
            
            chunk.forEach(op => {
                if (op.type === 'delete') batch.delete(op.ref);
                else if (op.type === 'update') batch.update(op.ref, (op as any).data);
            });

            const { notifySyncRegistry } = await import('../sync-registry');
            await notifySyncRegistry('suppliers', { batch });
            if (paymentsToDeleteArr.size > 0 || paymentsToUpdateMap.size > 0) {
                await notifySyncRegistry('payments', { batch });
            }
            await batch.commit();
        }

        if (db) {
            const { isLocalFolderMode, removePaymentsFromFolderFile, removeRecordFromFolderFile } = await import('@/lib/local-folder-storage').catch(() => ({ isLocalFolderMode: () => false, removePaymentsFromFolderFile: async () => false, removeRecordFromFolderFile: async () => false }));
            
            const pIdsArray = Array.from(paymentsToDeleteArr);
            if (isLocalFolderMode() && pIdsArray.length > 0) {
                const rows = await db.payments.where('id').anyOf(pIdsArray).toArray();
                const pids = rows.map((p: any) => String(p.paymentId ?? p.id).trim()).filter(Boolean);
                if (pids.length) await removePaymentsFromFolderFile('payments', pids).catch(() => {});
            }
            if (isLocalFolderMode()) {
                for (const sid of validSupplierIds) await removeRecordFromFolderFile('suppliers', sid, 'id').catch(() => {});
            }

            await db.suppliers.bulkDelete(validSupplierIds);
            await db.payments.bulkDelete(pIdsArray);
            
            for (const [pid, info] of paymentsToUpdateMap.entries()) {
                const p = await db.payments.get(pid);
                if (p) {
                    await db.payments.update(pid, { 
                        paidFor: info.updatedPaidFor, 
                        amount: (Number(p.amount) || 0) - info.amountToDeduct 
                    });
                }
            }

            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('indexeddb:collection:changed', { detail: { collection: 'suppliers' } }));
                window.dispatchEvent(new CustomEvent('indexeddb:collection:changed', { detail: { collection: 'payments' } }));
            }
        }
    } catch (error) {
        console.error('[Bulk Delete Error]', error);
        throw error;
    }
}

export async function recalculateAndUpdateSuppliers(supplierIds: string[]): Promise<number> {
    const { getHolidays: fetchHolidays, getDailyPaymentLimit: fetchLimit } = await import('./settings');
    const holidays = await fetchHolidays();
    const dailyPaymentLimit = await fetchLimit();
    const paymentHistory = await db.payments.toArray(); 
    
    let updatedCount = 0;

    for (const id of supplierIds) {
        let supplierData: Customer | undefined;
        if (db) supplierData = await db.suppliers.get(id);

        if (!supplierData && !isSqliteMode()) {
            const supplierRef = doc(suppliersCollection, id);
            const supplierSnap = await getDoc(supplierRef);
            if (supplierSnap.exists()) supplierData = supplierSnap.data() as Customer;
        }
        
        if (supplierData) {
            const recalculatedData = calculateSupplierEntry(supplierData, paymentHistory, holidays, dailyPaymentLimit, []);
            const updatePayload = {
                weight: recalculatedData.weight,
                kartaWeight: recalculatedData.kartaWeight,
                kartaAmount: recalculatedData.kartaAmount,
                netWeight: recalculatedData.netWeight,
                labouryAmount: recalculatedData.labouryAmount,
                amount: recalculatedData.amount,
                originalNetAmount: recalculatedData.originalNetAmount,
                netAmount: recalculatedData.originalNetAmount,
                dueDate: (recalculatedData as any).dueDate,
            };
            
            if (db) await db.suppliers.update(id, updatePayload);

            if (!isSqliteMode()) {
                const batch = writeBatch(firestoreDB);
                const supplierRef = doc(suppliersCollection, id);
                batch.update(supplierRef, updatePayload);
                const { notifySyncRegistry } = await import('../sync-registry');
                await notifySyncRegistry('suppliers', { batch });
                await batch.commit();
            }
            updatedCount++;
        }
    }
    return updatedCount;
}

export async function recalculateAndUpdateAllSuppliers(): Promise<number> {
    const suppliers = await getAllSuppliers();
    return recalculateAndUpdateSuppliers(suppliers.map(s => s.id));
}

export async function deleteAllSuppliers(): Promise<void> {
    const suppliers = await getAllSuppliers();
    if (!suppliers.length) return;
    await deleteMultipleSuppliers(suppliers.map(s => s.id));
}

export async function getAllSuppliers(): Promise<Customer[]> {
  if (isSqliteMode() && db) {
    return db.suppliers.toArray();
  }
  const snapshot = await getDocs(suppliersCollection);
  return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Customer));
}

export function getSuppliersRealtime(
    callback: (data: Customer[]) => void,
    onError: (error: Error) => void
): () => void {
    return createLocalSubscription<Customer>("suppliers", callback);
}

export async function getAllSupplierBankAccounts(): Promise<any[]> {
  if (isSqliteMode() && db) {
    return db.supplierBankAccounts.toArray();
  }
  const snapshot = await getDocs(supplierBankAccountsCollection);
  return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
}

function chunkArray<T>(items: T[], size: number): T[][] {
    const result: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
        result.push(items.slice(i, i + size));
    }
    return result;
}

export async function bulkUpsertSuppliers(suppliers: Customer[], chunkSize = 400) {
    if (!suppliers.length) return;
    const chunks = chunkArray(suppliers, chunkSize);
    for (const chunk of chunks) {
        const batch = writeBatch(firestoreDB);
        chunk.forEach((supplier) => {
            if (!supplier.id) throw new Error("Supplier entry missing id");
            const ref = doc(suppliersCollection, supplier.id);
            batch.set(ref, supplier, { merge: true });
        });
        await batch.commit();
    }
}

// --- Pagination Functions ---

export async function getInitialSuppliers(limitCount = 50): Promise<Customer[]> {
    if (isSqliteMode() && db) {
        const all = await db.suppliers.toArray();
        return all.slice(0, limitCount);
    }
    const q = query(suppliersCollection, orderBy('updatedAt', 'desc'), limit(limitCount));
    const snap = await getDocs(q);
    return snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Customer));
}

export async function getMoreSuppliers(lastSupplier: Customer, limitCount = 50): Promise<Customer[]> {
    if (isSqliteMode() && db) {
        const all = await db.suppliers.toArray();
        return all.slice(50, 50 + limitCount); // Simple fallback
    }
    const { startAfter } = await import('firebase/firestore');
    const lastDoc = await getDoc(doc(suppliersCollection, lastSupplier.id));
    const q = query(suppliersCollection, orderBy('updatedAt', 'desc'), startAfter(lastDoc), limit(limitCount));
    const snap = await getDocs(q);
    return snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Customer));
}

export async function getInitialPayments(limitCount = 50): Promise<Payment[]> {
    if (isSqliteMode() && db) {
        const all = await db.payments.toArray();
        return all.sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, limitCount) as Payment[];
    }
    const q = query(supplierPaymentsCollection, orderBy('date', 'desc'), limit(limitCount));
    const snap = await getDocs(q);
    return snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Payment));
}

export async function getMorePayments(lastPayment: Payment, limitCount = 50): Promise<Payment[]> {
    if (isSqliteMode() && db) {
        const all = await db.payments.toArray();
        return all.sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(50, 50 + limitCount) as Payment[];
    }
    const { startAfter } = await import('firebase/firestore');
    const lastDoc = await getDoc(doc(supplierPaymentsCollection, lastPayment.id));
    const q = query(supplierPaymentsCollection, orderBy('date', 'desc'), startAfter(lastDoc), limit(limitCount));
    const snap = await getDocs(q);
    return snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Payment));
}
