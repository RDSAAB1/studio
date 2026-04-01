const fs = require('fs');
try {
  const txt = fs.readFileSync('C:\\Users\\Raman Duggal\\AppData\\Roaming\\nextn\\net-log.json', 'utf8');
  const buf = txt.split('{"params"');
  for (let b of buf) {
    if (b.includes('"net_error":-10') && !b.includes('-100')) {
       console.log("Found -10 near: " + b.substring(0, 500));
    }
  }
} catch (e) { console.error(e); }
