const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  try {
    const list = fs.readdirSync(dir);
    list.forEach(file => {
      file = path.join(dir, file);
      const stat = fs.statSync(file);
      if (stat && stat.isDirectory()) {
        results = results.concat(walk(file));
      } else {
        if (file.endsWith('.sqlite')) {
          results.push(file);
        }
      }
    });
  } catch (e) {}
  return results;
}

const dbFiles = walk('C:\\Users\\Raman Duggal\\OneDrive\\BIZSUITE');
console.log("DB Files found:", dbFiles);
