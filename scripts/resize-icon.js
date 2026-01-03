const fs = require('fs');
const path = require('path');

// Simple script to resize icon-192.png to icon-512.png
// Note: This requires sharp package for proper image resizing
// Alternative: Use online converter or generate-icons.html

const PUBLIC_DIR = path.join(__dirname, '..', 'PUBLIC');
const ICON_192 = path.join(PUBLIC_DIR, 'icon-192.png');
const ICON_512 = path.join(PUBLIC_DIR, 'icon-512.png');

console.log('📋 Icon-512.png Generate Karne Ke Tarike:\n');

console.log('✅ Method 1: generate-icons.html Tool (Sabse Aasan)');
console.log('   1. npm run dev (agar running nahi hai)');
console.log('   2. Browser mein kholo: http://localhost:3000/generate-icons.html');
console.log('   3. "Download icon-512.png" button click karo');
console.log('   4. File PUBLIC folder mein copy karo\n');

console.log('✅ Method 2: Online Converter');
console.log('   1. https://convertio.co/png-png/ ya https://resizeimage.net/ kholo');
console.log('   2. icon-192.png upload karo');
console.log('   3. Size 512x512 set karo');
console.log('   4. Download karo aur icon-512.png naam se save karo');
console.log('   5. PUBLIC folder mein copy karo\n');

console.log('✅ Method 3: ImageMagick (Agar Installed Hai)');
console.log('   cd PUBLIC');
console.log('   magick convert -resize 512x512 icon-192.png icon-512.png\n');

// Check if icon-192 exists
if (fs.existsSync(ICON_192)) {
    console.log('✅ icon-192.png found!\n');
    
    if (fs.existsSync(ICON_512)) {
        console.log('✅ icon-512.png already exists!');
    } else {
        console.log('⚠️  icon-512.png abhi tak nahi hai.');
        console.log('   Upar wale methods mein se koi bhi use karo.\n');
    }
} else {
    console.log('❌ icon-192.png nahi mila!');
    console.log('   Pehle icon-192.png add karo.\n');
}













