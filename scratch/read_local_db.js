const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

function readDb() {
    const dbPath = "C:\\Users\\Raman Duggal\\OneDrive\\BIZSUITE\\season\\2\\jrmd.sqlite";
    if (!fs.existsSync(dbPath)) {
        console.error(`Could not find SQLite DB at: ${dbPath}`);
        return;
    }

    console.log(`Reading local database at: ${dbPath}`);
    const db = new Database(dbPath);

    const tables = [
        'suppliers', 'customers', 'payments', 'customerPayments', 
        'banks', 'bankBranches', 'bankAccounts', 'supplierBankAccounts', 
        'fundTransactions', 'transactions', 'ledgerEntries', 'ledgerAccounts',
        '_sync_meta', '_sync_log'
    ];

    for (const t of tables) {
        try {
            const count = db.prepare(`SELECT count(*) as count FROM ${t}`).get().count;
            console.log(`Local Table ${t}: Found ${count} rows.`);
            
            if (count > 0) {
                // Let's get distinct values of _company_id, _sub_company_id, _year if they exist
                const columns = db.prepare(`PRAGMA table_info(${t})`).all().map(c => c.name);
                let query = `SELECT id `;
                if (columns.includes('_company_id')) query += `, _company_id`;
                if (columns.includes('_sub_company_id')) query += `, _sub_company_id`;
                if (columns.includes('_year')) query += `, _year`;
                query += ` FROM ${t} LIMIT 3`;
                
                const samples = db.prepare(query).all();
                console.log(`  Sample ${t} entries:`, samples);
            }
        } catch (e) {
            console.log(`Local Table ${t}: Error - ${e.message}`);
        }
    }

    db.close();
}

readDb();
