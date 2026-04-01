const Database = require('better-sqlite3');
const crypto = require('crypto');

function getRowId(row, tableName, idx) {
  const stableFallback = () => {
    try {
      const json = JSON.stringify(row) || '';
      const h = crypto.createHash('sha1').update(json).digest('hex').slice(0, 16);
      return `${tableName}_${h}`;
    } catch {
      return `${tableName}_${idx}`;
    }
  };
  
  let id = (row.id != null && String(row.id).trim() !== '') ? String(row.id).trim() : null;
  
  if (!id) {
    id = (row.paymentId && String(row.paymentId).trim()) ||
         (row.srNo && String(row.srNo).trim()) ||
         (row.parchiNo && String(row.parchiNo).trim()) ||
         (row.transactionId && String(row.transactionId).trim()) ||
         (row.voucherNo && String(row.voucherNo).trim()) ||
         (row.employeeId && String(row.employeeId).trim()) ||
         (row.accountId && String(row.accountId).trim()) ||
         (row.accountNumber && String(row.accountNumber).trim()) ||
         (row.ifscCode && String(row.ifscCode).trim()) ||
         (row.loanId && String(row.loanId).trim()) ||
         (row.sku && String(row.sku).trim()) ||
         (row.documentSrNo && String(row.documentSrNo).trim());
  }

  return (id || stableFallback()).slice(0, 500);
}

const dbPath = 'C:\\Users\\Raman Duggal\\OneDrive\\BIZSUITE\\season\\2\\jrmd.sqlite';
try {
  const db = new Database(dbPath, { readonly: true });
  const tables = ['suppliers', 'customers', 'payments'];
  
  for (const t of tables) {
    console.log(`\n--- TABLE: ${t} ---`);
    const rows = db.prepare(`SELECT id, data FROM ${t} LIMIT 5`).all();
    console.log(`Found ${rows.length} sample rows`);
    for (const r of rows) {
      const data = JSON.parse(r.data);
      const calculatedId = getRowId(data, t, 0);
      console.log(`SQLite ID: ${r.id} | Calculated ID: ${calculatedId} | Match: ${r.id === calculatedId}`);
      if (r.id !== calculatedId) {
        console.log(`Mismatch details: data id=${data.id}, srNo=${data.srNo}, name=${data.name || data.supplierName}`);
      }
    }
  }
} catch (e) {
  console.log("Error:", e.message);
}
