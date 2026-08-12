const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

function inspect() {
    const dbPath = "C:\\Users\\Raman Duggal\\OneDrive\\BIZSUITE\\season\\2\\jrmd.sqlite";
    if (!fs.existsSync(dbPath)) {
        console.error(`Could not find SQLite DB at: ${dbPath}`);
        return;
    }

    console.log(`Reading local database at: ${dbPath}`);
    // We open read-only to be safe
    const db = new Database(dbPath, { readonly: true });

    const tables = [
        'suppliers', 'customers', 'payments', 'customerPayments', 
        'banks', 'bankBranches', 'bankAccounts', 'supplierBankAccounts', 
        'fundTransactions', 'transactions', 'ledgerEntries', 'ledgerAccounts',
        'ledgerCashAccounts', 'incomeCategories', 'expenseCategories', 'settings', 'options', 'loans'
    ];

    for (const t of tables) {
        try {
            // Check if columns exist
            const columns = db.prepare(`PRAGMA table_info(${t})`).all().map(c => c.name);
            
            let query = `SELECT `;
            const selectCols = [];
            const groupCols = [];
            
            if (columns.includes('_company_id')) {
                selectCols.push('_company_id');
                groupCols.push('_company_id');
            }
            if (columns.includes('_sub_company_id')) {
                selectCols.push('_sub_company_id');
                groupCols.push('_sub_company_id');
            }
            if (columns.includes('_year')) {
                selectCols.push('_year');
                groupCols.push('_year');
            }

            if (selectCols.length === 0) {
                // Table has no tenancy columns, print count
                const count = db.prepare(`SELECT count(*) as count FROM ${t}`).get().count;
                console.log(`Table ${t}: total ${count} (No tenancy columns)`);
                continue;
            }

            query += selectCols.join(', ') + `, count(*) as count FROM ${t} GROUP BY ` + groupCols.join(', ');
            const rows = db.prepare(query).all();
            
            console.log(`Table ${t}:`);
            for (const r of rows) {
                console.log(`  -> ` + JSON.stringify(r));
            }
        } catch (e) {
            console.log(`Table ${t}: Error - ${e.message}`);
        }
    }

    db.close();
}

inspect();
