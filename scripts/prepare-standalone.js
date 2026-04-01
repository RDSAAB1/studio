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
if (fs.existsSync('.env.local')) {
  fs.copyFileSync('.env.local', path.join(standaloneDir, '.env.local'));
}
if (fs.existsSync('.env')) {
  fs.copyFileSync('.env', path.join(standaloneDir, '.env'));
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

// CRITICAL: Ensure node_modules in standalone are NOT symlinks but real folders.
// Next.js standalone build often uses symlinks which break when only .next/standalone is unpacked from ASAR.
const standaloneNM = path.join(standaloneDir, 'node_modules');
if (fs.existsSync(standaloneNM)) {
  console.log('[prepare-standalone] Dereferencing standalone node_modules (this may take a moment)...');
  const tempNM = path.join('.next', 'standalone_node_modules_temp');
  if (fs.existsSync(tempNM)) fs.rmSync(tempNM, { recursive: true, force: true });
  
  try {
    // fs.cpSync with dereference: true turns symlinks into real directories
    fs.cpSync(standaloneNM, tempNM, { recursive: true, dereference: true, force: true });
    fs.rmSync(standaloneNM, { recursive: true, force: true });
    fs.renameSync(tempNM, standaloneNM);
    console.log('[prepare-standalone] node_modules dereferenced successfully.');
    
    // Forcefully ensure core dependencies are present (Next.js 15 standalone sometimes misses them)
    const criticalDeps = ['next', 'react', 'react-dom'];
    criticalDeps.forEach(dep => {
      const src = path.join('node_modules', dep);
      const dest = path.join(standaloneNM, dep);
      if (fs.existsSync(src)) {
        // If it's missing or effectively empty/symlinked, copy it
        const needsCopy = !fs.existsSync(dest) || fs.lstatSync(dest).isSymbolicLink();
        if (needsCopy) {
          console.log(`[prepare-standalone] Forcefully copying critical dependency: ${dep}`);
          fs.cpSync(src, dest, { recursive: true, dereference: true, force: true });
        }
      }
    });

  } catch (e) {
    console.error(`[prepare-standalone] ERROR dereferencing node_modules: ${e.message}`);
    if (fs.existsSync(tempNM)) fs.rmSync(tempNM, { recursive: true, force: true });
  }
}

console.log('[prepare-standalone] Done.');
