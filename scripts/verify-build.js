const fs = require('fs');
const path = require('path');

function verify() {
  console.log('[verify-build] Starting pre-build verification...');
  
  const issues = [];
  
  // 1. Check standalone folder
  const standaloneDir = path.join('.next', 'standalone');
  if (!fs.existsSync(path.join(standaloneDir, 'server.js'))) {
    issues.push('Missing server.js in .next/standalone');
  }
  if (!fs.existsSync(path.join(standaloneDir, '.next', 'static'))) {
    issues.push('Missing .next/static in .next/standalone');
  }
  if (!fs.existsSync(path.join(standaloneDir, 'public'))) {
    issues.push('Missing public in .next/standalone');
  }
  
  // 2. Check main entry point
  if (!fs.existsSync('electron/main.js')) {
    issues.push('Missing electron/main.js');
  }
  
  // 3. Check node_modules for critical deps
  if (!fs.existsSync('node_modules/sql.js')) {
    issues.push('Missing node_modules/sql.js - sqlite will fail');
  }
  
  // 4. Check for icon
  if (!fs.existsSync('PUBLIC/icon-512.png')) {
    issues.push('Missing PUBLIC/icon-512.png');
  }

  if (issues.length > 0) {
    console.error('[verify-build] Verification failed with following issues:');
    issues.forEach(msg => console.error(`  - ${msg}`));
    process.exit(1);
  }
  
  console.log('[verify-build] Verification successful! Build can proceed.');
}

verify();
