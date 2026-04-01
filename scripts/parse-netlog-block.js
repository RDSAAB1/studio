const fs = require('fs');
try {
  const txt = fs.readFileSync('C:\\Users\\Raman Duggal\\AppData\\Roaming\\nextn\\net-log.json', 'utf8');
  const buf = txt.split('{"params"');
  for (let b of buf) {
    if (b.includes('"net_error":-105') || (b.includes('"net_error":-10') && !b.includes('-100'))) {
       console.log("Found error near block:");
       console.log(b.substring(0, 1500));
    }
  }
} catch(e) { console.error(e); }
