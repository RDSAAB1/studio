const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  try {
    const list = fs.readdirSync(dir);
    list.forEach(file => {
      file = path.join(dir, file);
      const stat = fs.statSync(file);
      if (stat && stat.isDirectory()) {
        results = results.concat(walk(file));
      } else {
        if (file.endsWith('.sqlite') && !file.includes('backup')) {
          results.push(file);
        }
      }
    });
  } catch (e) {}
  return results;
}

async function searchDb(dbPath) {
  try {
    const filebuffer = fs.readFileSync(dbPath);
    const SQL = await initSqlJs();
    const db = new SQL.Database(filebuffer);
    
    // Check if table payments exists
    let hasPayments = false;
    try {
      db.exec("SELECT 1 FROM payments LIMIT 1");
      hasPayments = true;
    } catch (e) {}
    
    if (!hasPayments) return;
    
    const stmt = db.prepare("SELECT data FROM payments");
    while (stmt.step()) {
      const row = stmt.getAsObject();
      const data = JSON.parse(row.data);
      const ac = data.bankAcNo || '';
      const amt = data.amount || 0;
      const rtgsAmt = data.rtgsAmount || 0;
      if (ac === '32501169461' || amt === 230510 || rtgsAmt === 230510) {
        console.log(`\n=== FOUND IN ${dbPath} ===`);
        console.log(JSON.stringify(data, null, 2));
      }
    }
    stmt.free();
  } catch (e) {
    console.error("Error reading", dbPath, ":", e.message);
  }
}

async function main() {
  const dbFiles = walk('C:\\Users\\Raman Duggal\\OneDrive\\BIZSUITE');
  console.log("Found", dbFiles.length, "non-backup SQLite files. Searching...");
  for (const dbFile of dbFiles) {
    await searchDb(dbFile);
  }
  console.log("\nSearch finished.");
}

main();
