const Database = require('better-sqlite3');
const path = require('path');

try {
  const db = new Database('C:\\Users\\Raman Duggal\\OneDrive\\BIZSUITE\\season\\2\\jrmd.sqlite', {readonly: true});
  console.log("Database opened successfully.");
  
  const tables = ['payments'];
  for (const t of tables) {
    try {
      const results = db.prepare(`SELECT id, data FROM ${t}`).all();
      console.log(`Checking table ${t}, found ${results.length} rows...`);
      for (const row of results) {
        const data = JSON.parse(row.data);
        if (data.bankAcNo === '32501169461' || data.amount === 230510 || data.rtgsAmount === 230510) {
          console.log(`FOUND in ${t}:`, JSON.stringify(data, null, 2));
        }
      }
    } catch(e) {
      console.log(`Error checking table ${t}:`, e.message);
    }
  }
} catch(e) {
  console.log("DB Open Error:", e);
}
