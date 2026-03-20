/**
 * Copies public and static files into .next/standalone for Electron build.
 * Required by Next.js standalone mode.
 * Also fixes ENOENT for (public) route group - ensures dir exists.
 */
const fs = require('fs');
const path = require('path');

const standaloneDir = path.join('.next', 'standalone');
if (!fs.existsSync(path.join(standaloneDir, 'server.js'))) {
  console.log('[prepare-standalone] No standalone build found. Run "next build" first.');
  process.exit(0);
}

console.log('[prepare-standalone] Preparing standalone folder for Electron...');

if (fs.existsSync('public')) {
  fs.cpSync('public', path.join(standaloneDir, 'public'), { recursive: true });
}
if (fs.existsSync('.next/static')) {
  fs.cpSync('.next/static', path.join(standaloneDir, '.next', 'static'), { recursive: true });
}

// Copy critical server files that Next.js might have missed (Fixes ENOENT warnings)
const criticalServerDirs = ['server/app', 'server/pages'];
criticalServerDirs.forEach(dirPath => {
  const src = path.join('.next', dirPath);
  const dest = path.join(standaloneDir, '.next', dirPath);
  if (fs.existsSync(src)) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    try {
      fs.cpSync(src, dest, { recursive: true, force: true, dereference: true });
      console.log(`[prepare-standalone] Aggressively copied ${dirPath}`);
    } catch (e) {
      console.warn(`[prepare-standalone] Warning: Could not copy ${dirPath}: ${e.message}`);
    }
  }
});

// Copy all manifest files from .next to standalone/.next
const manifests = fs.readdirSync('.next').filter(f => f.endsWith('.json'));
manifests.forEach(file => {
  const src = path.join('.next', file);
  const dest = path.join(standaloneDir, '.next', file);
  if (!fs.existsSync(dest)) {
    fs.copyFileSync(src, dest);
    console.log(`[prepare-standalone] Copied manifest: ${file}`);
  }
});

console.log('[prepare-standalone] Done.');
