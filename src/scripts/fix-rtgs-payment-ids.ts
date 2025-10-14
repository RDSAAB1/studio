/**
 * Migration Script: Fix RTGS Payment IDs
 * 
 * Problem: Multiple RTGS payments have same paymentId but different rtgsSrNo
 * Solution: Update paymentId to match rtgsSrNo for all RTGS payments
 */

import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { firestoreDB } from '@/lib/firebase';

export async function fixRtgsPaymentIds() {
    console.log('Starting RTGS Payment ID migration...');
    console.log('-------------------------------------------');
    
    try {
        const paymentsRef = collection(firestoreDB, 'payments');
        const snapshot = await getDocs(paymentsRef);
        
        const batch = writeBatch(firestoreDB);
        let updateCount = 0;
        let skippedCount = 0;
        
        // Track duplicate paymentIds to identify the problem
        const paymentIdMap = new Map<string, number>();
        
        snapshot.forEach((docSnap) => {
            const payment = docSnap.data();
            
            // Check if it's an RTGS payment
            if (payment.receiptType === 'RTGS') {
                // Track paymentId occurrences
                const count = paymentIdMap.get(payment.paymentId) || 0;
                paymentIdMap.set(payment.paymentId, count + 1);
                
                // Check if rtgsSrNo exists and is different from paymentId
                if (payment.rtgsSrNo && payment.paymentId !== payment.rtgsSrNo) {
                    console.log(`\nFixing payment document ${docSnap.id}:`);
                    console.log(`  Document ID: ${docSnap.id}`);
                    console.log(`  Old paymentId: ${payment.paymentId}`);
                    console.log(`  RTGS SR No: ${payment.rtgsSrNo}`);
                    console.log(`  → New paymentId: ${payment.rtgsSrNo}`);
                    
                    // Update the paymentId field
                    const paymentRef = doc(firestoreDB, 'payments', docSnap.id);
                    batch.update(paymentRef, {
                        paymentId: payment.rtgsSrNo
                    });
                    
                    updateCount++;
                } else if (!payment.rtgsSrNo) {
                    console.warn(`\n⚠️ RTGS payment ${docSnap.id} has no rtgsSrNo field!`);
                    skippedCount++;
                } else {
                    // Already correct
                    console.log(`✓ Payment ${docSnap.id} already has correct paymentId: ${payment.paymentId}`);
                }
            }
        });
        
        // Report duplicate paymentIds
        console.log('\n-------------------------------------------');
        console.log('Duplicate PaymentId Report:');
        let foundDuplicates = false;
        paymentIdMap.forEach((count, paymentId) => {
            if (count > 1) {
                console.warn(`⚠️ PaymentId "${paymentId}" appears ${count} times`);
                foundDuplicates = true;
            }
        });
        if (!foundDuplicates) {
            console.log('✓ No duplicate paymentIds found after migration');
        }
        
        console.log('\n-------------------------------------------');
        console.log(`Total RTGS payments to update: ${updateCount}`);
        console.log(`Skipped (no rtgsSrNo): ${skippedCount}`);
        
        if (updateCount > 0) {
            await batch.commit();
            console.log(`\n✅ Successfully updated ${updateCount} RTGS payment(s)`);
            return { success: true, count: updateCount, skipped: skippedCount };
        } else {
            console.log('\n✅ No RTGS payments need updating');
            return { success: true, count: 0, skipped: skippedCount };
        }
        
    } catch (error) {
        console.error('\n❌ Error fixing RTGS payment IDs:', error);
        return { success: false, error };
    }
}
