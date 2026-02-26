import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { firestoreDB } from '@/lib/firebase';

export interface FixTransactionIdMismatchResult {
    success: boolean;
    count?: number;
    errors?: string[];
    error?: string;
}

export async function fixTransactionIdMismatch(): Promise<FixTransactionIdMismatchResult> {
    try {
        const collections = ['incomes', 'expenses'] as const;
        const batch = writeBatch(firestoreDB);
        let count = 0;

        for (const name of collections) {
            const colRef = collection(firestoreDB, name);
            const snapshot = await getDocs(colRef);

            snapshot.forEach((docSnap) => {
                const data = docSnap.data() as { transactionId?: string };
                const docId = docSnap.id;
                const currentTransactionId = data.transactionId;

                if (!currentTransactionId || currentTransactionId !== docId) {
                    const ref = doc(firestoreDB, name, docId);
                    batch.update(ref, { transactionId: docId });
                    count += 1;
                }
            });
        }

        if (count > 0) {
            await batch.commit();
        }

        return { success: true, count };
    } catch (error) {
        return {
            success: false,
            errors: [String(error)],
            error: String(error),
        };
    }
}
