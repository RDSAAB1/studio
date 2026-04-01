const fs = require('fs');

try {
  const txt = fs.readFileSync('C:\\Users\\Raman Duggal\\AppData\\Roaming\\nextn\\net-log.json', 'utf8');
  const buf = txt.split('{"params"');
  for (let b of buf) {
    if (b.includes('identitytoolkit') && b.includes('net_error') && !b.includes('"net_error":0')) {
      const errMatch = b.match(/"net_error":(-?\d+)/);
      if (errMatch) {
         console.log("Found error near identitytoolkit: ", errMatch[1]);
      }
    }
  }
} catch (e) { console.error(e); }
