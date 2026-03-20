/**
 * After electron-builder --win, copy JRMD Studio.exe to dist/ and open dist folder so exe is easy to find.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const dist = path.join(__dirname, '..', 'dist');
const winUnpacked = path.join(dist, 'win-unpacked');
const exeName = 'JRMD Studio.exe';
const src = path.join(winUnpacked, exeName);
const dest = path.join(dist, exeName);

if (fs.existsSync(src)) {
  fs.copyFileSync(src, dest);
  console.log('[copy-exe] Copied:', exeName, '-> dist/' + exeName);
} else {
  console.warn('[copy-exe] Not found:', src);
}

// Open dist folder in Explorer so user sees the exe (Windows)
if (process.platform === 'win32' && fs.existsSync(dist)) {
  try {
    execSync(`explorer "${dist}"`, { windowsHide: false });
    console.log('[copy-exe] Opened dist folder in Explorer.');
  } catch (_) {}
}
