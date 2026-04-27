const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'app', 'finance', 'daily-business-report', 'utils', 'print-utils.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Function to increase font sizes by ~2.5px
const scaleUp = (match, size) => {
    const newSize = parseFloat(size) + 2.5;
    return `font-size: ${newSize}px`;
};

// Regex to find font-size: Xpx
content = content.replace(/font-size:\s*(\d+(\.\d+)?)px/g, scaleUp);

// Also scale up header/total sizes which were already larger (e.g. 11px, 12px, 14px, 16px)
// We might have just scaled them by 2.5, which is fine (11->13.5, 12->14.5, 14->16.5, 16->18.5)

fs.writeFileSync(filePath, content, 'utf8');
console.log('Font sizes scaled up successfully.');
