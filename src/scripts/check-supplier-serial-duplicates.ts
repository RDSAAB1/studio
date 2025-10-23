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
    console.log('🔍 Starting Supplier Serial Number Duplicate Analysis...');
    console.log('=' .repeat(60));
    
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
        console.log('\n📊 ANALYSIS RESULTS:');
        console.log('=' .repeat(60));
        console.log(`Total Suppliers: ${suppliers.length}`);
        console.log(`Unique srNo values: ${srNoMap.size}`);
        console.log(`Empty srNo values: ${emptySrNos.length}`);
        console.log(`Empty ID values: ${emptyIds.length}`);
        
        if (Object.keys(duplicateSrNos).length > 0) {
            console.log('\n🚨 DUPLICATE SERIAL NUMBERS FOUND:');
            console.log('-' .repeat(40));
            Object.entries(duplicateSrNos).forEach(([srNo, records]) => {
                console.log(`\n📋 Serial Number: "${srNo}" (${records.length} records)`);
                records.forEach((record, index) => {
                    console.log(`  ${index + 1}. ID: ${record.id} | Name: ${record.name} | Date: ${record.date}`);
                });
            });
        } else {
            console.log('\n✅ No duplicate serial numbers found!');
        }
        
        if (Object.keys(duplicateIds).length > 0) {
            console.log('\n🚨 DUPLICATE IDs FOUND:');
            console.log('-' .repeat(40));
            Object.entries(duplicateIds).forEach(([id, records]) => {
                console.log(`\n📋 ID: "${id}" (${records.length} records)`);
                records.forEach((record, index) => {
                    console.log(`  ${index + 1}. srNo: ${record.srNo} | Name: ${record.name} | Date: ${record.date}`);
                });
            });
        } else {
            console.log('\n✅ No duplicate IDs found!');
        }
        
        if (emptySrNos.length > 0) {
            console.log('\n⚠️ EMPTY SERIAL NUMBERS:');
            console.log('-' .repeat(40));
            emptySrNos.forEach((record, index) => {
                console.log(`  ${index + 1}. ID: ${record.id} | Name: ${record.name} | Date: ${record.date}`);
            });
        }
        
        if (emptyIds.length > 0) {
            console.log('\n⚠️ EMPTY IDs:');
            console.log('-' .repeat(40));
            emptyIds.forEach((record, index) => {
                console.log(`  ${index + 1}. srNo: ${record.srNo} | Name: ${record.name} | Date: ${record.date}`);
            });
        }
        
        console.log('\n' + '=' .repeat(60));
        console.log('✅ Analysis completed successfully!');
        
        return {
            totalSuppliers: suppliers.length,
            duplicateSrNos,
            duplicateIds,
            emptySrNos,
            emptyIds,
            summary
        };
        
    } catch (error) {
        console.error('❌ Error during analysis:', error);
        throw error;
    }
}

// Auto-run if called directly
if (typeof window !== 'undefined') {
    (window as any).checkSupplierDuplicates = checkSupplierSerialDuplicates;
    console.log('🔧 Supplier duplicate checker loaded! Run: checkSupplierDuplicates()');
}
