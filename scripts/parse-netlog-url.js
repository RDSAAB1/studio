const fs = require('fs');
try {
  const txt = fs.readFileSync('C:\\Users\\Raman Duggal\\AppData\\Roaming\\nextn\\net-log.json', 'utf8');
  const buf = txt.split('{"params"');
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i];
    if (b.includes('"net_error":-105') || (b.includes('"net_error":-10') && !b.includes('-100'))) {
       // look back to find url
       for(let j=i; j >= Math.max(0, i-15); j--) {
          const urlMatch = buf[j].match(/"url":"([^"]+)"/);
          if (urlMatch) {
             console.log("Error", b.match(/"net_error":(-?\d+)/)[1], "on URL:", urlMatch[1]);
             break;
          }
       }
    }
  }
} catch(e) { console.error(e); }
