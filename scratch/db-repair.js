const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const paths = [
    'C:\\Users\\Raman Duggal\\OneDrive\\BIZSUITE\\season\\2\\jrmd.sqlite',
    path.join(process.env.APPDATA, 'studio', 'jrmd.sqlite'),
    path.join(process.env.APPDATA, 'JRMD SOFTWARE', 'studio', 'jrmd.sqlite')
];

for (const p of paths) {
    if (fs.existsSync(p)) {
        console.log(`Checking DB at: ${p}`);
        let db;
        try {
            db = new Database(p);
            const info = db.prepare("PRAGMA table_info(_sync_meta)").all();
            console.log("_sync_meta columns:", info.map(c => c.name).join(', '));
            const hasTimestamp = info.some(c => c.name === 'last_sync_timestamp');
            if (info.length === 0) {
              console.log("_sync_meta does not exist. Creating...");
              db.exec('CREATE TABLE _sync_meta (id TEXT PRIMARY KEY, last_sync_timestamp INTEGER DEFAULT 0)');
            } else if (!hasTimestamp) {
                console.log("REPAIRING _sync_meta (Adding Column)...");
                db.exec('ALTER TABLE _sync_meta ADD COLUMN last_sync_timestamp INTEGER DEFAULT 0');
                console.log("REPAIR SUCCESSFUL");
            } else {
                console.log("_sync_meta already has the correct column.");
            }
        } catch (e) {
            console.error("Error with database:", e.message);
        } finally {
            if (db) db.close();
        }
    } else {
        console.log(`Path not found: ${p}`);
    }
}
