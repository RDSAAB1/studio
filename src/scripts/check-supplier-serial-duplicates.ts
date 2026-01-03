/**
 * Script: Check Supplier Serial Number Duplicates
 * 
 * Problem: ConstraintError in suppliers.bulkPut() due to duplicate srNo or id values
 * Solution: Analyze all suppliers and identify duplicate srNo/id values
 */

import { collection, getDocs } from 'firebase/firestore';
import { firestoreDB } from '@/lib/firebase';

export interface DuplicateAnalysis {
    totalSuppliers: number;
    duplicateSrNos: { [srNo: string]: any[] };
    duplicateIds: { [id: string]: any[] };
    emptySrNos: any[];
    emptyIds: any[];
    summary: string;
}

export async function checkSupplierSerialDuplicates(): Promise<DuplicateAnalysis> {


    try {
        const suppliersRef = collection(firestoreDB, 'suppliers');
        const snapshot = await getDocs(suppliersRef);
        
        const suppliers: any[] = [];
        const srNoMap = new Map<string, any[]>();
        const idMap = new Map<string, any[]>();
        const emptySrNos: any[] = [];
        const emptyIds: any[] = [];
        
        // Process all suppliers
        snapshot.forEach((doc) => {
            const supplier = { id: doc.id, ...doc.data() };
            suppliers.push(supplier);
            
            // Check srNo
            if (!supplier.srNo || supplier.srNo.trim() === '') {
                emptySrNos.push(supplier);
            } else {
                const srNo = supplier.srNo.trim();
                if (!srNoMap.has(srNo)) {
                    srNoMap.set(srNo, []);
                }
                srNoMap.get(srNo)!.push(supplier);
            }
            
            // Check id
            if (!supplier.id || supplier.id.trim() === '') {
                emptyIds.push(supplier);
            } else {
                const id = supplier.id.trim();
                if (!idMap.has(id)) {
                    idMap.set(id, []);
                }
                idMap.get(id)!.push(supplier);
            }
        });
        
        // Find duplicates
        const duplicateSrNos: { [srNo: string]: any[] } = {};
        const duplicateIds: { [id: string]: any[] } = {};
        
        srNoMap.forEach((records, srNo) => {
            if (records.length > 1) {
                duplicateSrNos[srNo] = records;
            }
        });
        
        idMap.forEach((records, id) => {
            if (records.length > 1) {
                duplicateIds[id] = records;
            }
        });
        
        // Generate summary
        const totalDuplicates = Object.values(duplicateSrNos).reduce((sum, records) => sum + records.length, 0);
        const totalIdDuplicates = Object.values(duplicateIds).reduce((sum, records) => sum + records.length, 0);
        
        const summary = `Total: ${suppliers.length} suppliers | ` +
                       `Unique srNo: ${srNoMap.size} | ` +
                       `Duplicate srNo groups: ${Object.keys(duplicateSrNos).length} (${totalDuplicates} records) | ` +
                       `Duplicate ID groups: ${Object.keys(duplicateIds).length} (${totalIdDuplicates} records) | ` +
                       `Empty srNo: ${emptySrNos.length} | ` +
                       `Empty ID: ${emptyIds.length}`;
        
        // Log detailed results






        if (Object.keys(duplicateSrNos).length > 0) {


            Object.entries(duplicateSrNos).forEach(([srNo, records]) => {

                records.forEach((record, index) => {

                });
            });
        } else {

        }
        
        if (Object.keys(duplicateIds).length > 0) {


            Object.entries(duplicateIds).forEach(([id, records]) => {

                records.forEach((record, index) => {

                });
            });
        } else {

        }
        
        if (emptySrNos.length > 0) {


            emptySrNos.forEach((record, index) => {

            });
        }
        
        if (emptyIds.length > 0) {


            emptyIds.forEach((record, index) => {

            });
        }


        return {
            totalSuppliers: suppliers.length,
            duplicateSrNos,
            duplicateIds,
            emptySrNos,
            emptyIds,
            summary
        };
        
    } catch (error) {

        throw error;
    }
}

// Auto-run if called directly
if (typeof window !== 'undefined') {
    (window as any).checkSupplierDuplicates = checkSupplierSerialDuplicates;

}
