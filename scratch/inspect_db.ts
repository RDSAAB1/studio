
import { db } from './src/lib/database';

async function checkData() {
    try {
        const firstSupplier = await db.suppliers.limit(1).toArray();
        const firstPayment = await db.payments.limit(1).toArray();
        
        console.log('--- DATA INSPECTION ---');
        console.log('Supplier 0:', JSON.stringify(firstSupplier[0] || 'NONE', null, 2));
        console.log('Payment 0:', JSON.stringify(firstPayment[0] || 'NONE', null, 2));
    } catch (e) {
        console.error('Error reading data:', e);
    }
}

checkData();
