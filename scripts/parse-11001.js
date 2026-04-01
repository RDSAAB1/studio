const fs = require('fs');
try {
  const txt = fs.readFileSync('C:\\Users\\Raman Duggal\\AppData\\Roaming\\nextn\\net-log.json', 'utf8');
  const buf = txt.split('{"params"');
  for (let i = 0; i < buf.length; i++) {
    if (buf[i].includes('11001')) {
       console.log("Found 11001 block:");
       // look forwards or backwards for "host"
       for(let j=Math.max(0, i-20); j <= Math.min(buf.length-1, i+20); j++) {
           if (buf[j].includes('"host":')) {
               const hm = buf[j].match(/"host":"([^"]+)"/);
               if (hm) console.log("Host that failed DNS:", hm[1]);
           }
       }
    }
  }
} catch(e) { console.error(e); }
