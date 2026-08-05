const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src');

function walk(dir, callback) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filepath = path.join(dir, file);
    const stat = fs.statSync(filepath);
    if (stat.isDirectory()) {
      walk(filepath, callback);
    } else if (stat.isFile() && (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.css'))) {
      callback(filepath);
    }
  }
}

console.log('Starting indigo-to-amber theme replacement sweep...');

walk(srcDir, (filepath) => {
  let content = fs.readFileSync(filepath, 'utf8');
  let original = content;

  // Replace indigo- to amber-
  content = content.replace(/\b(text|bg|border|ring|stroke|fill|from|via|to|placeholder|hover|focus|focus-visible|data-\[state=active\]):indigo-(\d+)\b/g, '$1:amber-$2');
  content = content.replace(/\b(text|bg|border|ring|stroke|fill|from|via|to|placeholder|hover|focus|focus-visible|data-\[state=active\]):indigo-(\d+)\/(\d+)\b/g, '$1:amber-$2/$3');
  
  // Direct classes
  content = content.replace(/\bindigo-(\d+)\b/g, 'amber-$1');

  if (content !== original) {
    fs.writeFileSync(filepath, content, 'utf8');
    console.log(`Updated: ${path.relative(srcDir, filepath)}`);
  }
});

console.log('Indigo theme replacement sweep completed successfully!');
