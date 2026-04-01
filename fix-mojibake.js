const fs = require('fs');
const path = require('path');

const targetDirs = [
    path.join(__dirname, 'src/app'),
    path.join(__dirname, 'src/components'),
    path.join(__dirname, 'src/lib')
];

const patterns = {
    'â‚¹': '₹',
    'â€”': '—',
    'â€¢': '•',
    'â†’': '→'
};

function walkDir(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            walkDir(fullPath);
        } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let modified = false;
            
            for (const [mojibake, original] of Object.entries(patterns)) {
                if (content.includes(mojibake)) {
                    content = content.replace(new RegExp(mojibake, 'g'), original);
                    modified = true;
                }
            }
            
            if (modified) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log('Fixed mojibake in', fullPath);
            }
        }
    }
}

targetDirs.forEach(dir => walkDir(dir));
console.log('Done.');
