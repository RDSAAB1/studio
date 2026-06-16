const fg = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

function scanDir(dir) {
  let results = [];
  try {
    const list = fg.readdirSync(dir);
    list.forEach(file => {
      const fullPath = path.join(dir, file);
      const stat = fg.statSync(fullPath);
      if (stat && stat.isDirectory()) {
        if (!file.startsWith('.') && file !== 'node_modules' && file.toLowerCase() !== 'backups') {
          results = results.concat(scanDir(fullPath));
        }
      } else if (file.endsWith('.sqlite')) {
        results.push({ path: fullPath, size: stat.size });
      }
    });
  } catch (e) {}
  return results;
}

const baseOneDrive = 'C:\\Users\\Raman Duggal\\OneDrive\\BIZSUITE';
if (fg.existsSync(baseOneDrive)) {
  const dbs = scanDir(baseOneDrive);
  console.log(`Found ${dbs.length} SQLite files in OneDrive. Searching...`);
  
  initSqlJs().then(SQL => {
    dbs.forEach(dbInfo => {
      try {
        const filebuffer = fg.readFileSync(dbInfo.path);
        const db = new SQL.Database(filebuffer);
        const res = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
        if (!res || res.length === 0) return;
        const tables = res[0].values.map(v => v[0]);
        
        tables.forEach(t => {
          try {
            // Check if column 'data' exists
            const colsInfo = db.prepare(`PRAGMA table_info(${t})`);
            let hasData = false;
            while(colsInfo.step()) {
              const col = colsInfo.getAsObject();
              if (col.name === 'data') hasData = true;
            }
            colsInfo.free();
            if (!hasData) return;

            const stmt = db.prepare(`SELECT data FROM ${t}`);
            while(stmt.step()) {
              const row = stmt.getAsObject();
              const dStr = row.data || '';
              if (dStr.toLowerCase().includes('jindal') || dStr.toLowerCase().includes('l00433')) {
                console.log(`[FOUND] DB: ${dbInfo.path} | Table: ${t} | Row: ${dStr}`);
              }
            }
            stmt.free();
          } catch (te) {}
        });
        db.close();
      } catch (dbe) {
        // console.log(`Error reading ${dbInfo.path}:`, dbe.message);
      }
    });
    console.log("Search complete.");
  });
}


