const Database = require('better-sqlite3');
const path = require('path');

try {
  const db = new Database('C:\\Users\\Raman Duggal\\OneDrive\\BIZSUITE\\season\\2\\jrmd.sqlite', {readonly: true});
  console.log("Database opened successfully.");
  
  // Check customer_payments table
  try {
    const rows = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log("Tables:", rows.map(r => r.name));
    
    // Search customer_payments and payments tables
    const tables = ['customer_payments', 'payments', 'transactions'];
    for (const t of tables) {
      try {
        const results = db.prepare(`SELECT id, data FROM ${t}`).all();
        console.log(`Checking table ${t}, found ${results.length} rows...`);
        for (const row of results) {
          const data = JSON.parse(row.data);
          if (data.id === 'L00433' || data.paymentId === 'L00433') {
            console.log(`FOUND in ${t}:`, JSON.stringify(data, null, 2));
          }
        }
      } catch(e) {
        console.log(`Error checking table ${t}:`, e.message);
      }
    }
  } catch(e) {
    console.log("Query Error:", e.message);
  }
} catch(e) {
  console.log("DB Open Error:", e);
}
