const fs = require('fs');
const path = require('path');

function searchAll(dir, targetFile) {
    let results = [];
    try {
        const list = fs.readdirSync(dir);
        for (const file of list) {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            if (stat && stat.isDirectory()) {
                // Skip very large directories to stay fast
                if (file !== 'node_modules' && file !== '.git' && file !== 'Local Extension Settings' && file !== 'Cache' && file !== 'System Volume Information') {
                    results = results.concat(searchAll(filePath, targetFile));
                }
            } else if (file.toLowerCase() === targetFile.toLowerCase()) {
                results.push(filePath);
            }
        }
    } catch (e) {
        // ignore
    }
    return results;
}

const appData = path.join(process.env.APPDATA || '', '..');
console.log(`Searching for config.json and jrmd.sqlite in AppData: ${appData}`);
const configs = searchAll(appData, 'config.json');
const dbs = searchAll(appData, 'jrmd.sqlite');
console.log("Found config.json files:", configs);
console.log("Found jrmd.sqlite files:", dbs);

if (configs.length > 0) {
    console.log("Content of configs:");
    for (const c of configs) {
        try {
            console.log(`${c}:`, fs.readFileSync(c, 'utf8'));
        } catch(e) {}
    }
}
