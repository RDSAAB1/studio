/**
 * Script: Fix Supplier Serial Number Duplicates
 * 
 * Problem: Duplicate srNo or id values causing ConstraintError
 * Solution: Fix duplicates by generating unique values
 */

import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { firestoreDB } from '@/lib/firebase';

export interface FixResult {
    success: boolean;
    fixedSrNos: number;
    fixedIds: number;
    skipped: number;
    errors: string[];
    summary: string;
}

export async function fixSupplierSerialDuplicates(): Promise<FixResult> {
    console.log('🔧 Starting Supplier Serial Number Duplicate Fix...');
    console.log('=' .repeat(60));
    
    try {
        const suppliersRef = collection(firestoreDB, 'suppliers');
        const snapshot = await getDocs(suppliersRef);
        
        const suppliers: any[] = [];
        const srNoMap = new Map<string, any[]>();
        const idMap = new Map<string, any[]>();
        
        // Process all suppliers
        snapshot.forEach((doc) => {
            const supplier = { id: doc.id, ...doc.data() };
            suppliers.push(supplier);
            
            // Track srNo
            if (supplier.srNo && supplier.srNo.trim() !== '') {
                const srNo = supplier.srNo.trim();
                if (!srNoMap.has(srNo)) {
                    srNoMap.set(srNo, []);
                }
                srNoMap.get(srNo)!.push(supplier);
            }
            
            // Track id
            if (supplier.id && supplier.id.trim() !== '') {
                const id = supplier.id.trim();
                if (!idMap.has(id)) {
                    idMap.set(id, []);
                }
                idMap.get(id)!.push(supplier);
            }
        });
        
        const batch = writeBatch(firestoreDB);
        let fixedSrNos = 0;
        let fixedIds = 0;
        let skipped = 0;
        const errors: string[] = [];
        
        // Fix duplicate srNos
        console.log('\n🔧 FIXING DUPLICATE SERIAL NUMBERS:');
        console.log('-' .repeat(40));
        
        srNoMap.forEach((records, srNo) => {
            if (records.length > 1) {
                console.log(`\n📋 Fixing srNo: "${srNo}" (${records.length} duplicates)`);
                
                // Keep first record, fix others
                records.slice(1).forEach((record, index) => {
                    const newSrNo = generateUniqueSrNo(srNo, index + 1);
                    console.log(`  ${index + 2}. ID: ${record.id} → New srNo: "${newSrNo}"`);
                    
                    try {
                        const supplierRef = doc(firestoreDB, 'suppliers', record.id);
                        batch.update(supplierRef, { srNo: newSrNo });
                        fixedSrNos++;
                    } catch (error) {
                        errors.push(`Failed to fix srNo for ${record.id}: ${error}`);
                    }
                });
            }
        });
        
        // Fix duplicate IDs
        console.log('\n🔧 FIXING DUPLICATE IDs:');
        console.log('-' .repeat(40));
        
        idMap.forEach((records, id) => {
            if (records.length > 1) {
                console.log(`\n📋 Fixing ID: "${id}" (${records.length} duplicates)`);
                
                // Keep first record, fix others
                records.slice(1).forEach((record, index) => {
                    const newId = generateUniqueId(id, index + 1);
                    console.log(`  ${index + 2}. srNo: ${record.srNo} → New ID: "${newId}"`);
                    
                    try {
                        // Note: We can't update document ID directly, so we'll update the id field
                        const supplierRef = doc(firestoreDB, 'suppliers', record.id);
                        batch.update(supplierRef, { id: newId });
                        fixedIds++;
                    } catch (error) {
                        errors.push(`Failed to fix ID for ${record.id}: ${error}`);
                    }
                });
            }
        });
        
        // Fix empty srNos
        console.log('\n🔧 FIXING EMPTY SERIAL NUMBERS:');
        console.log('-' .repeat(40));
        
        suppliers.forEach((supplier) => {
            if (!supplier.srNo || supplier.srNo.trim() === '') {
                const newSrNo = generateUniqueSrNo('S', 0);
                console.log(`  ID: ${supplier.id} → New srNo: "${newSrNo}"`);
                
                try {
                    const supplierRef = doc(firestoreDB, 'suppliers', supplier.id);
                    batch.update(supplierRef, { srNo: newSrNo });
                    fixedSrNos++;
                } catch (error) {
                    errors.push(`Failed to fix empty srNo for ${supplier.id}: ${error}`);
                }
            }
        });
        
        // Fix empty IDs
        console.log('\n🔧 FIXING EMPTY IDs:');
        console.log('-' .repeat(40));
        
        suppliers.forEach((supplier) => {
            if (!supplier.id || supplier.id.trim() === '') {
                const newId = generateUniqueId('SUP', 0);
                console.log(`  srNo: ${supplier.srNo} → New ID: "${newId}"`);
                
                try {
                    const supplierRef = doc(firestoreDB, 'suppliers', supplier.id);
                    batch.update(supplierRef, { id: newId });
                    fixedIds++;
                } catch (error) {
                    errors.push(`Failed to fix empty ID for ${supplier.id}: ${error}`);
                }
            }
        });
        
        // Commit all changes
        if (fixedSrNos > 0 || fixedIds > 0) {
            console.log('\n💾 Committing changes to database...');
            await batch.commit();
            console.log('✅ All changes committed successfully!');
        } else {
            console.log('\n✅ No fixes needed - all data is clean!');
        }
        
        const summary = `Fixed ${fixedSrNos} srNo duplicates, ${fixedIds} ID duplicates. ${errors.length} errors.`;
        
        console.log('\n' + '=' .repeat(60));
        console.log('✅ Fix completed successfully!');
        console.log(`📊 Summary: ${summary}`);
        
        if (errors.length > 0) {
            console.log('\n⚠️ Errors encountered:');
            errors.forEach(error => console.log(`  - ${error}`));
        }
        
        return {
            success: true,
            fixedSrNos,
            fixedIds,
            skipped,
            errors,
            summary
        };
        
    } catch (error) {
        console.error('❌ Error during fix:', error);
        return {
            success: false,
            fixedSrNos: 0,
            fixedIds: 0,
            skipped: 0,
            errors: [error.toString()],
            summary: 'Fix failed due to error'
        };
    }
}

function generateUniqueSrNo(baseSrNo: string, index: number): string {
    // Extract prefix and number from base srNo
    const match = baseSrNo.match(/^([A-Za-z]+)(\d+)$/);
    if (match) {
        const prefix = match[1];
        const baseNum = parseInt(match[2]);
        const newNum = baseNum + index;
        return `${prefix}${newNum.toString().padStart(5, '0')}`;
    }
    
    // Fallback: add index to base
    return `${baseSrNo}_${index}`;
}

function generateUniqueId(baseId: string, index: number): string {
    // If it's a simple string, add index
    if (!baseId.includes('_')) {
        return `${baseId}_${index}`;
    }
    
    // If it already has underscore, increment the number
    const parts = baseId.split('_');
    const lastPart = parts[parts.length - 1];
    const num = parseInt(lastPart) || 0;
    parts[parts.length - 1] = (num + index).toString();
    return parts.join('_');
}

// Auto-run if called directly
if (typeof window !== 'undefined') {
    (window as any).fixSupplierDuplicates = fixSupplierSerialDuplicates;
    console.log('🔧 Supplier duplicate fixer loaded! Run: fixSupplierDuplicates()');
}
