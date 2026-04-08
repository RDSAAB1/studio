const fs = require('fs');
const content = fs.readFileSync('c:/RAMAN DUGGAL/JRMD SOFTWARE/studio/src/app/tools/voucher-import/page.tsx', 'utf8');
let balance = 0;
let lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  // Remove string literals to avoid counting braces inside them
  // This is a naive regex but should work for this case
  let cleanLine = line.replace(/`[\s\S]*?`|'[\s\S]*?'|"[\s\S]*?"/g, '');
  // Also remove comments
  cleanLine = cleanLine.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '');
  
  for (let char of cleanLine) {
    if (char === '{') balance++;
    if (char === '}') balance--;
  }
  if (balance < 0) {
    console.log(`Mismatch at line ${i + 1}: balance ${balance}`);
    // Reset balance to avoid cascading errors if possible, but usually one mismatch is the root
  }
}
console.log('Final balance:', balance);
