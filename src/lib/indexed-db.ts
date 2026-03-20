import { db } from '@/lib/database';
import { Payment, CustomerPayment } from '@/lib/definitions';

/**
 * Saves a payment to IndexedDB for offline access.
 * This is used as a fallback when Firestore is unreachable or for immediate local updates.
 * 
 * @param paymentData The payment object to save
 * @param collectionName The name of the collection/table in IndexedDB ('payments', 'customerPayments', 'governmentFinalizedPayments')
 */
export async function savePaymentOffline(
  paymentData: Payment | CustomerPayment | any,
  collectionName: string
) {
  if (typeof window === 'undefined' || !db) return;

  try {
    const table = (db as any)[collectionName];
    if (table) {
        const primaryKey = String(paymentData?.paymentId || paymentData?.id || paymentData?.rtgsSrNo || '').trim();
        const isNewEntry = !primaryKey;
        // New entry: generate unique paymentId so we always have a stable key (SQLite uses paymentId as PK)
        const uniquePaymentId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
        const normalizedPaymentId = (isNewEntry ? uniquePaymentId : String(paymentData?.paymentId || primaryKey || '').trim()) || uniquePaymentId;

        let pfArr: unknown[] = [];
        if (Array.isArray(paymentData?.paidFor) && paymentData.paidFor.length > 0) {
          pfArr = JSON.parse(JSON.stringify(paymentData.paidFor)) as unknown[];
        } else if (typeof (paymentData as any)?.paidFor === 'string' && String((paymentData as any).paidFor).trim().startsWith('[')) {
          try { pfArr = JSON.parse((paymentData as any).paidFor); } catch { pfArr = []; }
        }
        // Ensure paidFor is always a plain array for file + Dexie (finalize must persist receipt detail)
        if (!Array.isArray(pfArr)) pfArr = [];
        const normalizedPaymentData = {
          ...paymentData,
          paymentId: normalizedPaymentId || uniquePaymentId,
          paidFor: pfArr,
        } as Record<string, unknown>;
        // Normalize root updatedAt (Firestore Timestamp -> ISO string) so linking/display is consistent
        const rootU = normalizedPaymentData.updatedAt;
        if (rootU && typeof rootU === 'object' && 'seconds' in rootU && typeof (rootU as any).seconds === 'number') {
          const s = (rootU as { seconds: number; nanoseconds?: number }).seconds;
          const ns = (rootU as { seconds: number; nanoseconds?: number }).nanoseconds ?? 0;
          normalizedPaymentData.updatedAt = new Date(s * 1000 + ns / 1e6).toISOString();
        }
        // Receipt/entry linking: normalize each paidFor line (Timestamps → ISO)
        if (normalizedPaymentData.paidFor && Array.isArray(normalizedPaymentData.paidFor) && (normalizedPaymentData.paidFor as unknown[]).length > 0) {
          const raw = JSON.parse(JSON.stringify(normalizedPaymentData.paidFor)) as Record<string, unknown>[];
          const normalizedPaidFor = raw.map((item) => {
            const out = { ...item };
            // Firestore Timestamp -> ISO string so Excel/IndexedDB stay consistent and linking works
            const u = (item as any).updatedAt;
            if (u && typeof u === 'object' && 'seconds' in u && typeof (u as any).seconds === 'number') {
              const sec = (u as { seconds: number; nanoseconds?: number }).seconds;
              const ns = (u as { seconds: number; nanoseconds?: number }).nanoseconds ?? 0;
              (out as any).updatedAt = new Date(sec * 1000 + ns / 1e6).toISOString();
            } else if (typeof u === 'string') {
              (out as any).updatedAt = u;
            }
            // Ensure numeric fields are numbers (for reports/linking)
            if (typeof (out as any).amount !== 'number') (out as any).amount = Number((out as any).amount) || 0;
            if (typeof (out as any).cdAmount !== 'number') (out as any).cdAmount = Number((out as any).cdAmount) || 0;
            if (typeof (out as any).adjustedOutstanding !== 'number' && (out as any).adjustedOutstanding != null) (out as any).adjustedOutstanding = Number((out as any).adjustedOutstanding) || 0;
            if (typeof (out as any).adjustedOriginal !== 'number' && (out as any).adjustedOriginal != null) (out as any).adjustedOriginal = Number((out as any).adjustedOriginal) || 0;
            if (typeof (out as any).receiptOutstanding !== 'number' && (out as any).receiptOutstanding != null) (out as any).receiptOutstanding = Number((out as any).receiptOutstanding) || 0;
            if (typeof (out as any).extraAmount !== 'number' && (out as any).extraAmount != null) (out as any).extraAmount = Number((out as any).extraAmount) || 0;
            return out;
          });
          normalizedPaymentData.paidFor = normalizedPaidFor as typeof paymentData.paidFor;
        }

        // File-first (local folder): write to file first with paidFor guaranteed (finalize = receipt detail in PaidFor sheet)
        if (collectionName === 'payments' || collectionName === 'customerPayments') {
          try {
            const { isLocalFolderMode, writePaymentToFolderFile } = await import('@/lib/local-folder-storage');
            if (isLocalFolderMode()) {
              const forFile = { ...normalizedPaymentData, paidFor: Array.isArray(normalizedPaymentData.paidFor) ? JSON.parse(JSON.stringify(normalizedPaymentData.paidFor)) : [] } as Record<string, unknown>;
              await writePaymentToFolderFile(collectionName, forFile);
            }
          } catch {
            try {
              const { isLocalFolderMode, writePaymentToFolderFile } = await import('@/lib/local-folder-storage');
              if (isLocalFolderMode()) {
                const forFile = { ...normalizedPaymentData, paidFor: Array.isArray(normalizedPaymentData.paidFor) ? JSON.parse(JSON.stringify(normalizedPaymentData.paidFor)) : [] } as Record<string, unknown>;
                await writePaymentToFolderFile(collectionName, forFile);
              }
            } catch { /* ignore */ }
          }
        }

        const shouldDeduplicateByPaymentId =
          collectionName === 'payments' ||
          collectionName === 'customerPayments' ||
          collectionName === 'governmentFinalizedPayments';

        if (shouldDeduplicateByPaymentId && normalizedPaymentId && !isNewEntry) {
          const existingRows = await table.where('paymentId').equals(normalizedPaymentId).toArray();
          const rowsToDelete = existingRows
            .map((row: any) => row?.paymentId)
            .filter((existingId: any) => existingId !== undefined && existingId !== null && String(existingId) !== normalizedPaymentId);
          if (rowsToDelete.length > 0) {
            await table.bulkDelete(rowsToDelete);
          }
        }

        // Then upsert Dexie (cache) so UI shows the payment (payments tables are keyed by paymentId)
        await table.put(normalizedPaymentData);

        window.dispatchEvent(new CustomEvent('indexeddb:payment:updated', {
            detail: {
                payment: normalizedPaymentData,
                collection: collectionName,
                id: normalizedPaymentId
            }
        }));
    } else {
        console.error(`Table ${collectionName} not found in IndexedDB`);
    }
  } catch (error) {
    console.error('Error saving payment offline:', error);
    // Don't throw - we don't want to break the flow if local save fails
  }
}
