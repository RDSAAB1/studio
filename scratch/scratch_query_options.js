const Database = require('better-sqlite3');

try {
  const db = new Database('C:\\Users\\Raman Duggal\\OneDrive\\BIZSUITE\\season\\2\\jrmd.sqlite', {readonly: true});
  console.log("Database opened.");
  
  const options = db.prepare(`SELECT * FROM options`).all();
  console.log(`Total options: ${options.length}`);
  if (options.length > 0) {
    console.log("First option raw:", options[0]);
    try {
      console.log("First option parsed:", JSON.parse(options[0].data));
    } catch(e) {}
  }
  
  console.log("\nTesting dynamic json_extract query (json_extract(data, '$.' || 'type') = 'varieties'):");
  try {
    const rows = db.prepare(`SELECT * FROM options WHERE json_extract(data, '$.' || 'type') = 'varieties'`).all();
    console.log(`Query returned ${rows.length} rows.`);
    rows.forEach(r => console.log(r.id, r.data));
  } catch(e) {
    console.error("Query failed:", e.message);
  }
  
  console.log("\nTesting direct json_extract query (json_extract(data, '$.type') = 'varieties'):");
  try {
    const rows = db.prepare(`SELECT * FROM options WHERE json_extract(data, '$.type') = 'varieties'`).all();
    console.log(`Query returned ${rows.length} rows.`);
  } catch(e) {
    console.error("Query failed:", e.message);
  }
} catch(e) {
  console.error("Error opening DB:", e);
}
