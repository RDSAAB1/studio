import { NextResponse } from "next/server";
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const dbPath = "C:\\Users\\Raman Duggal\\OneDrive\\BIZSUITE\\season\\2\\jrmd.sqlite";
    if (!fs.existsSync(dbPath)) {
      return NextResponse.json({ error: `SQLite database not found at: ${dbPath}` }, { status: 404 });
    }

    const Database = require('better-sqlite3');
    const db = new Database(dbPath);

    const tables = [
        'suppliers', 'customers', 'payments', 'customerPayments', 
        'banks', 'bankBranches', 'bankAccounts', 'supplierBankAccounts', 
        'fundTransactions', 'transactions', 'ledgerEntries', 'ledgerAccounts',
        'ledgerCashAccounts', 'incomeCategories', 'expenseCategories', 'settings', 'options', 'loans'
    ];

    const results: any = {};

    for (const t of tables) {
        try {
            const columns = db.prepare(`PRAGMA table_info(${t})`).all().map((c: any) => c.name);
            
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
                const count = db.prepare(`SELECT count(*) as count FROM ${t}`).get().count;
                results[t] = [{ count, info: "No tenancy columns" }];
                continue;
            }

            query += selectCols.join(', ') + `, count(*) as count FROM ${t} GROUP BY ` + groupCols.join(', ');
            const rows = db.prepare(query).all();
            results[t] = rows;
        } catch (e: any) {
            results[t] = { error: e.message };
        }
    }

    db.close();
    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
