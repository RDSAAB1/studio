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
        const primaryKey = String(
          paymentData?.id ||
            paymentData?.paymentId ||
            paymentData?.rtgsSrNo ||
            ''
        ).trim();
        const normalizedPaymentId = String(paymentData?.paymentId || primaryKey || '').trim();

        const normalizedPaymentData = {
          ...paymentData,
          ...(normalizedPaymentId ? { paymentId: normalizedPaymentId } : {}),
          ...(primaryKey ? { id: primaryKey } : {}),
        };

        const shouldDeduplicateByPaymentId =
          collectionName === 'payments' ||
          collectionName === 'customerPayments' ||
          collectionName === 'governmentFinalizedPayments';

        if (shouldDeduplicateByPaymentId && normalizedPaymentId) {
          const existingRows = await table.where('paymentId').equals(normalizedPaymentId).toArray();
          const rowsToDelete = existingRows
            .map((row: any) => row?.id)
            .filter((existingId: any) => existingId !== undefined && existingId !== null && String(existingId) !== primaryKey);
          if (rowsToDelete.length > 0) {
            await table.bulkDelete(rowsToDelete);
          }
        }

        await table.put(normalizedPaymentData);
        
        // Trigger generic payment update event (listened by UI components)
        window.dispatchEvent(new CustomEvent('indexeddb:payment:updated', {
            detail: { 
                payment: normalizedPaymentData,
                collection: collectionName,
                id: primaryKey || normalizedPaymentId
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
