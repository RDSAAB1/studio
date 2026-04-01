const fs = require('fs');
try {
  const txt = fs.readFileSync('C:\\Users\\Raman Duggal\\AppData\\Roaming\\nextn\\net-log.json', 'utf8');
  const buf = txt.split('{"params"');
  const errs = new Set();
  for (let b of buf) {
    const errMatch = b.match(/"net_error":(-?\d+)/);
    if (errMatch && errMatch[1] !== '0') {
       errs.add(errMatch[1]);
       if (errMatch[1] === '-10' || errMatch[1] === '-102' || errMatch[1] === '-21' || errMatch[1] === '-105') {
          console.log("Found major error near: " + b.substring(0, 150));
       }
    }
  }
  console.log("All unique net_errors:", [...errs].join(', '));
} catch (e) { console.error(e); }
