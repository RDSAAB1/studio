const sharp = require('sharp');
const pngToIco = require('png-to-ico').default;
const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, '../bizsuite logo.jpg');
const publicDir = path.join(__dirname, '../public');

async function generateIcons() {
  try {
    console.log('Starting icon generation...');

    if (!fs.existsSync(inputFile)) {
      console.error(`Error: Input file not found at ${inputFile}`);
      process.exit(1);
    }

    // Generate icon-512.png
    console.log('Generating icon-512.png...');
    await sharp(inputFile)
      .resize(512, 512, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .toFile(path.join(publicDir, 'icon-512.png'));

    // Generate icon-192.png
    console.log('Generating icon-192.png...');
    await sharp(inputFile)
      .resize(192, 192, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .toFile(path.join(publicDir, 'icon-192.png'));

    // Generate favicon.ico
    console.log('Generating favicon.ico...');
    const pngBuffer = await sharp(inputFile)
      .resize(32, 32, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png()
      .toBuffer();
    
    const icoBuffer = await pngToIco(pngBuffer);
    fs.writeFileSync(path.join(publicDir, 'favicon.ico'), icoBuffer);

    console.log('Successfully updated all icons!');
  } catch (error) {
    console.error('Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();
