const fg = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

function scanDir(dir, depth = 0) {
  if (depth > 4) return [];
  let results = [];
  try {
    const list = fg.readdirSync(dir);
    list.forEach(file => {
      const fullPath = path.join(dir, file);
      const stat = fg.statSync(fullPath);
      if (stat && stat.isDirectory()) {
        const lowerFile = file.toLowerCase();
        if (!file.startsWith('.') && lowerFile !== 'node_modules' && lowerFile !== 'microsoft' && lowerFile !== 'google' && lowerFile !== 'cache' && lowerFile !== 'backups') {
          results = results.concat(scanDir(fullPath, depth + 1));
        }
      } else if (file.endsWith('.sqlite') || file === 'jrmd.sqlite') {
        results.push({ path: fullPath, size: stat.size });
      }
    });
  } catch (e) {}
  return results;
}

const userHome = 'C:\\Users\\Raman Duggal';
const appDataDirs = [
  path.join(userHome, 'AppData', 'Roaming'),
  path.join(userHome, 'AppData', 'Local')
];

let allDbs = [];
appDataDirs.forEach(dir => {
  if (fg.existsSync(dir)) {
    console.log(`Scanning AppData dir: ${dir}`);
    allDbs = allDbs.concat(scanDir(dir));
  }
});

console.log(`Found ${allDbs.length} SQLite files in AppData:`);
allDbs.forEach(dbInfo => {
  console.log(`- ${dbInfo.path} (${dbInfo.size} bytes)`);
});

initSqlJs().then(SQL => {
  allDbs.forEach(dbInfo => {
    try {
      const filebuffer = fg.readFileSync(dbInfo.path);
      const db = new SQL.Database(filebuffer);
      const res = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
      if (!res || res.length === 0) return;
      const tables = res[0].values.map(v => v[0]);
      
      tables.forEach(t => {
        try {
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
            const dStr = row.data.toLowerCase();
            if (dStr.includes('jindal') || dStr.includes('l00433') || dStr.includes('c00256')) {
              console.log(`[FOUND MATCH] DB: ${dbInfo.path} | Table: ${t} | Row: ${row.data}`);
            }
          }
          stmt.free();
        } catch (te) {}
      });
      db.close();
    } catch (dbe) {}
  });
  console.log("Search complete.");
});



