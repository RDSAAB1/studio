/**
 * Migration Script: Fix RTGS Payment IDs
 * 
 * Problem: Multiple RTGS payments have same paymentId but different rtgsSrNo
 * Also fixes: IDs starting with "R" instead of "RT" (e.g., R00001 → RT00001)
 * Solution: Update paymentId to match rtgsSrNo for all RTGS payments
 */

import { collection, getDocs, writeBatch, doc, deleteDoc } from 'firebase/firestore';
import { firestoreDB } from '@/lib/firebase';

// Helper function to convert "R" prefix to "RT" prefix
function normalizeRtgsId(id: string | undefined): string | null {
    if (!id) return null;
    
    // Match patterns: R##### or RT#####
    const match = id.match(/^(R)(\d+)$/);
    if (match && match[1] === 'R') {
        // Convert R##### to RT#####
        return `RT${match[2].padStart(5, '0')}`;
    }
    
    // If already RT##### format, return as is (but ensure 5 digit padding)
    const rtMatch = id.match(/^(RT)(\d+)$/);
    if (rtMatch) {
        return `RT${rtMatch[2].padStart(5, '0')}`;
    }
    
    return null;
}

export async function fixRtgsPaymentIds() {
    console.log('Starting RTGS Payment ID migration...');
    console.log('Fixing duplicate IDs and R##### → RT##### conversion');
    console.log('-------------------------------------------');
    
    try {
        const paymentsRef = collection(firestoreDB, 'payments');
        const snapshot = await getDocs(paymentsRef);
        
        let updateCount = 0;
        let skippedCount = 0;
        let renamedCount = 0;
        let duplicateFixedCount = 0;
        
        // Track all RTGS IDs to detect duplicates
        const rtgsIdToDocuments = new Map<string, Array<{ docId: string; data: any }>>();
        
        // Store payments that need document ID renaming or fixing
        const documentsToRename: Array<{ oldId: string; newId: string; data: any }> = [];
        const documentsToFix: Array<{ docId: string; correctId: string; data: any }> = [];
        
        // First pass: Collect all RTGS payments and normalize their IDs
        snapshot.forEach((docSnap) => {
            const payment = docSnap.data();
            
            if (payment.receiptType === 'RTGS') {
                // Normalize IDs (R##### → RT#####)
                const normalizedRtgsSrNo = normalizeRtgsId(payment.rtgsSrNo);
                const normalizedPaymentId = normalizeRtgsId(payment.paymentId);
                const normalizedDocId = normalizeRtgsId(docSnap.id);
                
                // Determine the correct ID to use (prefer rtgsSrNo)
                let correctId: string | null = normalizedRtgsSrNo || normalizedPaymentId || normalizedDocId;
                
                if (!correctId) {
                    console.warn(`⚠️ RTGS payment ${docSnap.id} has no valid RTGS ID format!`);
                    skippedCount++;
                    return;
                }
                
                // Track this ID to detect duplicates
                if (!rtgsIdToDocuments.has(correctId)) {
                    rtgsIdToDocuments.set(correctId, []);
                }
                rtgsIdToDocuments.get(correctId)!.push({
                    docId: docSnap.id,
                    data: payment
                });
            }
        });
        
        // Second pass: Fix duplicates and normalize IDs
        rtgsIdToDocuments.forEach((documents, correctId) => {
            if (documents.length === 1) {
                // Single document - just normalize IDs if needed
                const { docId, data } = documents[0];
                const normalizedDocId = normalizeRtgsId(docId);
                const needsDocRename = normalizedDocId && docId !== normalizedDocId;
                const needsPaymentIdUpdate = data.paymentId !== correctId;
                const needsRtgsSrNoUpdate = data.rtgsSrNo !== correctId;
                
                if (needsDocRename) {
                    documentsToRename.push({
                        oldId: docId,
                        newId: normalizedDocId!,
                        data: { ...data, paymentId: correctId, rtgsSrNo: correctId }
                    });
                    renamedCount++;
                    updateCount++;
                } else if (needsPaymentIdUpdate || needsRtgsSrNoUpdate) {
                    documentsToFix.push({
                        docId,
                        correctId,
                        data
                    });
                    updateCount++;
                }
            } else {
                // Multiple documents with same ID - assign unique IDs
                console.log(`\n⚠️ Found ${documents.length} duplicate RTGS IDs: ${correctId}`);
                
                documents.forEach((docInfo, index) => {
                    let uniqueId: string;
                    
                    if (index === 0) {
                        // Keep first one with original ID
                        uniqueId = correctId;
                    } else {
                        // Generate unique ID for duplicates
                        const match = correctId.match(/^RT(\d+)$/);
                        if (match) {
                            const baseNum = parseInt(match[1], 10);
                            // Try to find next available number
                            let newNum = baseNum + index;
                            let attempts = 0;
                            
                            // Find an available ID (not used by any existing document)
                            while (rtgsIdToDocuments.has(`RT${newNum.toString().padStart(5, '0')}`) && attempts < 100) {
                                newNum++;
                                attempts++;
                            }
                            
                            uniqueId = `RT${newNum.toString().padStart(5, '0')}`;
                            console.log(`  → Assigning unique ID to document ${docInfo.docId}: ${correctId} → ${uniqueId}`);
                        } else {
                            // Fallback: use timestamp or random suffix
                            uniqueId = `${correctId}_${index}`;
                        }
                    }
                    
                    const normalizedDocId = normalizeRtgsId(docInfo.docId);
                    const needsDocRename = normalizedDocId && docInfo.docId !== uniqueId && docInfo.docId !== normalizedDocId;
                    
                    if (needsDocRename || docInfo.docId !== uniqueId) {
                        // Rename document to unique ID
                        documentsToRename.push({
                            oldId: docInfo.docId,
                            newId: uniqueId,
                            data: { 
                                ...docInfo.data, 
                                paymentId: uniqueId, 
                                rtgsSrNo: uniqueId,
                                id: uniqueId
                            }
                        });
                        duplicateFixedCount++;
                        renamedCount++;
                    } else {
                        // Just update fields
                        documentsToFix.push({
                            docId: docInfo.docId,
                            correctId: uniqueId,
                            data: docInfo.data
                        });
                    }
                    updateCount++;
                });
            }
        });
        
        // Field updates will be applied during batch commit
        
        
        // Report duplicate IDs (before fixing)
        console.log('\n-------------------------------------------');
        console.log('Duplicate ID Summary (before fixing):');
        const duplicateIds = Array.from(rtgsIdToDocuments.entries()).filter(([_, docs]) => docs.length > 1);
        if (duplicateIds.length > 0) {
            duplicateIds.forEach(([id, docs]) => {
                console.warn(`  ⚠️ ${id}: ${docs.length} duplicate(s) found`);
            });
        } else {
            console.log('  ✓ No duplicate IDs found');
        }
        
        console.log('\n-------------------------------------------');
        console.log(`Total RTGS payments processed: ${snapshot.size}`);
        console.log(`Payments updated: ${updateCount}`);
        console.log(`Documents renamed: ${renamedCount}`);
        console.log(`Duplicate IDs fixed: ${duplicateFixedCount}`);
        console.log(`Skipped (invalid format): ${skippedCount}`);
        
        if (updateCount > 0 || documentsToRename.length > 0) {
            // Commit in batches to avoid Firestore limits (500 operations per batch)
            const BATCH_SIZE = 450; // Leave room for safety
            let currentBatch = writeBatch(firestoreDB);
            let batchOps = 0;
            let batchesCommitted = 0;
            
            // First, commit field updates (from documentsToFix)
            if (documentsToFix.length > 0) {
                console.log(`\n-------------------------------------------`);
                console.log(`Updating ${documentsToFix.length} document(s)...`);
                
                for (const { docId, correctId, data } of documentsToFix) {
                    if (batchOps >= BATCH_SIZE) {
                        await currentBatch.commit();
                        batchesCommitted++;
                        currentBatch = writeBatch(firestoreDB);
                        batchOps = 0;
                    }
                    
                    const paymentRef = doc(firestoreDB, 'payments', docId);
                    const updates: any = {};
                    
                    if (data.paymentId !== correctId) {
                        updates.paymentId = correctId;
                    }
                    if (data.rtgsSrNo !== correctId) {
                        updates.rtgsSrNo = correctId;
                    }
                    
                    if (Object.keys(updates).length > 0) {
                        currentBatch.update(paymentRef, updates);
                        batchOps++;
                    }
                }
            }
            
            // Then, process renames (each rename = 2 ops: set + delete)
            if (documentsToRename.length > 0) {
                console.log(`\n-------------------------------------------`);
                console.log(`Renaming ${documentsToRename.length} document(s)...`);
                
                for (const { oldId, newId, data } of documentsToRename) {
                    if (batchOps >= BATCH_SIZE - 1) { // Reserve 1 op for delete
                        await currentBatch.commit();
                        batchesCommitted++;
                        currentBatch = writeBatch(firestoreDB);
                        batchOps = 0;
                    }
                    
                    const newDocRef = doc(firestoreDB, 'payments', newId);
                    currentBatch.set(newDocRef, data);
                    batchOps++;
                    
                    const oldDocRef = doc(firestoreDB, 'payments', oldId);
                    currentBatch.delete(oldDocRef);
                    batchOps++;
                    
                    console.log(`  ✓ Renamed: ${oldId} → ${newId}`);
                }
            }
            
            // Commit remaining operations
            if (batchOps > 0) {
                await currentBatch.commit();
                batchesCommitted++;
            }
            
            console.log(`\n✅ Successfully processed ${updateCount} RTGS payment(s)`);
            if (renamedCount > 0) {
                console.log(`✅ Renamed ${renamedCount} document(s)`);
            }
            if (duplicateFixedCount > 0) {
                console.log(`✅ Fixed ${duplicateFixedCount} duplicate ID(s)`);
            }
            return { success: true, count: updateCount, renamed: renamedCount, duplicatesFixed: duplicateFixedCount, skipped: skippedCount };
        } else {
            console.log('\n✅ No RTGS payments need updating');
            return { success: true, count: 0, renamed: 0, duplicatesFixed: 0, skipped: skippedCount };
        }
        
    } catch (error) {
        console.error('\n❌ Error fixing RTGS payment IDs:', error);
        return { success: false, error };
    }
}
