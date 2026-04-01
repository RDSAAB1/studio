const fs = require('fs');

try {
  const txt = fs.readFileSync('C:\\Users\\Raman Duggal\\AppData\\Roaming\\nextn\\net-log.json', 'utf8');
  // net-log.json might be truncated because of taskkill.
  // We'll search for the block surrounding identitytoolkit.googleapis.com
  const blocks = txt.split('{"params"');
  for (let b of blocks) {
    if (b.includes('identitytoolkit.googleapis.com')) {
      console.log("----");
      console.log('{"params"' + b.substring(0, 1000));
    }
    if (b.includes('"net_error":') && !b.includes('"net_error":0')) {
        // extract the error
        const match = b.match(/"net_error":(-?\d+)/);
        if (match && match[1] !== "0") {
            const errCode = match[1];
            // print some payload
            if (b.includes('googleapis')) {
                console.log("Found error near googleapis: " + errCode);
                console.log(b.substring(0, 500));
            }
        }
    }
  }
} catch (e) {
  console.error(e);
}
