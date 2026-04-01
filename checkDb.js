const { app } = require('electron');
const Database = require('better-sqlite3');

app.whenReady().then(() => {
  console.log("Checking DB...");
  try {
    const db = new Database('C:\\Users\\Raman Duggal\\OneDrive\\BIZSUITE\\season\\2\\jrmd.sqlite', {readonly: true});
    const tables = ['customers', 'payments', 'suppliers', 'transactions'];
    for (const t of tables) {
      try {
        const rows = db.prepare(`SELECT id, data FROM ${t}`).all();
        console.log(`Table ${t}: ${rows.length} rows`);
        let errs = 0;
        for (const r of rows) {
          try {
            JSON.parse(r.data);
          } catch(e) {
            errs++;
            console.log(`JSON parse error on id ${r.id}:`, r.data);
          }
        }
        if (errs>0) console.log(`${t} had ${errs} parse errors`);
      } catch(e) {
        console.log(`Error reading table ${t}:`, e.message);
      }
    }
  } catch(e) {
    console.log("DB Open Error:", e);
  }
  app.quit();
});
