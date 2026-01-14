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


    try {
        const suppliersRef = collection(firestoreDB, 'suppliers');
        const snapshot = await getDocs(suppliersRef);
        
        type SupplierRecord = { id: string; srNo?: string } & Record<string, any>;
        const suppliers: SupplierRecord[] = [];
        const srNoMap = new Map<string, any[]>();
        const idMap = new Map<string, any[]>();
        
        // Process all suppliers
        snapshot.forEach((doc) => {
            const supplier: SupplierRecord = { id: doc.id, ...(doc.data() as Record<string, any>) };
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


        srNoMap.forEach((records, srNo) => {
            if (records.length > 1) {

                // Keep first record, fix others
                records.slice(1).forEach((record, index) => {
                    const newSrNo = generateUniqueSrNo(srNo, index + 1);

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


        idMap.forEach((records, id) => {
            if (records.length > 1) {

                // Keep first record, fix others
                records.slice(1).forEach((record, index) => {
                    const newId = generateUniqueId(id, index + 1);

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


        suppliers.forEach((supplier) => {
            if (!supplier.srNo || supplier.srNo.trim() === '') {
                const newSrNo = generateUniqueSrNo('S', 0);

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


        suppliers.forEach((supplier) => {
            if (!supplier.id || supplier.id.trim() === '') {
                const newId = generateUniqueId('SUP', 0);

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

            await batch.commit();

        } else {

        }
        
        const summary = `Fixed ${fixedSrNos} srNo duplicates, ${fixedIds} ID duplicates. ${errors.length} errors.`;



        if (errors.length > 0) {

            errors.forEach(error => (`  - ${error}`));
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

        return {
            success: false,
            fixedSrNos: 0,
            fixedIds: 0,
            skipped: 0,
            errors: [String(error)],
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

}
