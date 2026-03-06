import { firestoreDB } from "./firebase";
import { collection, getDocs, writeBatch } from "firebase/firestore";
import { notifySyncRegistry, COLLECTION_MAP } from "./sync-registry";
import { getTenantCollectionPath } from "./tenancy";

export interface MigrationResult {
    collection: string;
    total: number;
    updated: number;
    status: 'success' | 'error';
    message?: string;
}

/**
 * Migrates all documents in all collections to have an updatedAt field.
 * This ensures that the sync registry listener works correctly for all documents.
 */
export async function migrateUpdatedAt(): Promise<MigrationResult[]> {
    const results: MigrationResult[] = [];
    
    // Iterate over all collections
    for (const [internalName, firestoreName] of Object.entries(COLLECTION_MAP)) {
        try {
            const colRef = collection(firestoreDB, ...getTenantCollectionPath(firestoreName));
            const snapshot = await getDocs(colRef);
            
            if (snapshot.empty) {
                results.push({
                    collection: internalName,
                    total: 0,
                    updated: 0,
                    status: 'success',
                    message: 'Collection is empty'
                });
                continue;
            }

            let updatedCount = 0;
            const batchSize = 400; // Safe limit (Firestore max is 500)
            let currentBatch = writeBatch(firestoreDB);
            let countInBatch = 0;
            
            // We update ALL documents to ensure consistency and future-proof the sync
            for (const document of snapshot.docs) {
                const data = document.data();
                
                // Use current time as ISO string, consistent with other parts of the app
                const updatedAt = new Date().toISOString();
                
                // Update the document
                currentBatch.update(document.ref, { updatedAt });
                
                countInBatch++;
                updatedCount++;
                
                if (countInBatch >= batchSize) {
                    // Commit this batch of updates
                    // We DO NOT notify registry here to avoid triggering multiple client syncs
                    await currentBatch.commit();
                    
                    // Start new batch
                    currentBatch = writeBatch(firestoreDB);
                    countInBatch = 0;
                }
            }
            
            // Commit remaining
            if (countInBatch > 0) {
                await currentBatch.commit();
            }
            
            // Notify registry ONCE per collection after all updates are done
            // This ensures clients only fetch once per collection, saving reads
            if (updatedCount > 0) {
                await notifySyncRegistry(internalName);
            }
            
            results.push({
                collection: internalName,
                total: snapshot.size,
                updated: updatedCount,
                status: 'success'
            });
            
        } catch (error: any) {
            console.error(`Error migrating ${internalName}:`, error);
            results.push({
                collection: internalName,
                total: 0,
                updated: 0,
                status: 'error',
                message: error.message || 'Unknown error'
            });
        }
    }
    
    return results;
}
