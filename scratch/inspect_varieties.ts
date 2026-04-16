
import { varieties } from '../src/lib/database';
import { openDB } from '../src/lib/database';

async function inspectVarieties() {
    try {
        const db = await openDB();
        const suppliers = await db.getAll('suppliers');
        const customers = await db.getAll('customers');
        
        const sVarieties = Array.from(new Set(suppliers.map(s => s.variety)));
        const cVarieties = Array.from(new Set(customers.map(c => c.variety)));
        
        console.log('Supplier Varieties:', sVarieties);
        console.log('Customer Varieties:', cVarieties);
        
        const wheatRelated = sVarieties.filter(v => 
            v?.toString().toUpperCase().includes('WHEAT') || 
            v?.toString().toUpperCase().includes('GEHU') || 
            v?.toString().toUpperCase().includes('KANAK')
        );
        
        console.log('Wheat Related Varieties in DB:', wheatRelated);
    } catch (e) {
        console.error(e);
    }
}

inspectVarieties();
