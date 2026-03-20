const { app, BrowserWindow, Menu, ipcMain, dialog, protocol, globalShortcut, session } = require('electron');
const path = require('path');
const fs = require('fs');

// Required for protocol.registerHttpProtocol - must be before app.ready
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

const { exec, execSync, fork, spawn } = require('child_process');
let isDev = require('electron-is-dev');
if (typeof isDev !== 'boolean') {
  isDev = isDev && isDev.default !== undefined ? isDev.default : !!isDev;
}

let SERVER_PORT = 3000;
let SERVER_URL = `http://127.0.0.1:${SERVER_PORT}`;

function findFreePort(startPort) {
  const net = require('net');
  return new Promise((resolve) => {
    const server = net.createServer();
    server.on('error', () => resolve(findFreePort(startPort + 1)));
    server.listen(startPort, '127.0.0.1', () => {
      server.close(() => resolve(startPort));
    });
  });
}

function waitForServer(port, maxWaitMs = 60000) {
  const net = require('net');
  const start = Date.now();
  console.log(`[Electron] Waiting for port ${port} to be available...`);
  return new Promise((resolve) => {
    const check = () => {
      const socket = net.connect({ port, host: '127.0.0.1' }, () => {
        socket.end();
        console.log(`[Electron] Port ${port} is ready.`);
        resolve(true);
      });
      socket.on('error', () => {
        if (Date.now() - start > maxWaitMs) {
          console.error(`[Electron] Timeout waiting for port ${port}`);
          return resolve(false);
        }
        setTimeout(check, 1000);
      });
    };
    check();
  });
}

function getUnpackedAppPath() {
  const appPath = app.getAppPath();
  if (appPath.endsWith('app.asar')) {
    const unpacked = appPath.replace(/app\.asar$/, 'app.asar.unpacked');
    if (fs.existsSync(unpacked)) return unpacked;
    // Packaged app: also try resourcesPath (reliable after NSIS install)
    const resPath = path.join(process.resourcesPath || path.dirname(appPath), 'app.asar.unpacked');
    if (fs.existsSync(resPath)) return resPath;
  }
  return appPath;
}

function startNextServer(port) {
  const cwd = getUnpackedAppPath();
  const env = { ...process.env, PORT: String(port), HOSTNAME: '127.0.0.1', NODE_ENV: 'production' };
  
  // Run Next.js standalone server in a separate process to avoid blocking the main thread.
  const standaloneDir = path.join(cwd, '.next', 'standalone');
  const standaloneServerPath = path.join(standaloneDir, 'server.js');
  console.log(`[Electron] Checking for server.js at: ${standaloneServerPath}`);
  console.log(`[Electron] CWD: ${process.cwd()}`);
  if (fs.existsSync(standaloneServerPath)) {
    try {
      const logPath = path.join(app.getPath('userData'), 'server.log');
      const logStream = fs.createWriteStream(logPath, { flags: 'a' });
      
      const child = fork(standaloneServerPath, [], {
        cwd: standaloneDir,
        env,
        stdio: ['ignore', 'pipe', 'pipe', 'ipc']
      });

      child.stdout?.on('data', (d) => {
        logStream.write(`[STDOUT] ${d}\n`);
        console.log(`[Next Server] ${d}`);
      });
      child.stderr?.on('data', (d) => {
        logStream.write(`[STDERR] ${d}\n`);
        console.error(`[Next Server Error] ${d}`);
      });
      child.on('error', (e) => {
        logStream.write(`[ERROR] ${e.message}\n`);
        console.error('[Electron] Standalone server fork error:', e);
      });
      child.on('exit', (code) => {
        logStream.write(`[EXIT] Code: ${code}\n`);
        console.log('[Electron] Standalone server exited with code:', code);
      });
      return child;
    } catch (e) {
      console.error('[Electron] Failed to fork standalone server:', e);
    }
  }

  // Fallback: next-server.js
  const serverScript = path.join(__dirname, 'next-server.js');
  if (!fs.existsSync(serverScript)) {
    console.error('[Electron] next-server.js not found');
    return null;
  }
  const child = fork(serverScript, [], { cwd, env, stdio: 'pipe' });
  child.stdout?.on('data', (d) => console.log(`[Next Server] ${d}`));
  child.stderr?.on('data', (d) => console.error(`[Next Server Error] ${d}`));
  child.on('error', (e) => console.error('[Electron] Next server process error:', e));
  child.on('exit', (code) => console.log('[Electron] Next server process exited:', code));
  return child;
}

let sqliteDb = null;
let sqliteFolderPath = null;
let sqliteError = null;
let sqliteLib = null;

function getConfigPath() {
  try {
    return path.join(app.getPath('userData'), 'config.json');
  } catch {
    return null;
  }
}

function loadConfig() {
  const cfgPath = getConfigPath();
  if (!cfgPath) return {};
  try {
    if (!fs.existsSync(cfgPath)) return {};
    const raw = fs.readFileSync(cfgPath, 'utf8');
    return JSON.parse(raw || '{}');
  } catch {
    return {};
  }
}

function saveConfig(cfg) {
  const cfgPath = getConfigPath();
  if (!cfgPath) return;
  try {
    fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2), 'utf8');
  } catch {
    // ignore
  }
}

function getSqliteFolder() {
  if (sqliteFolderPath) return sqliteFolderPath;
  const cfg = loadConfig();
  if (cfg.sqliteFolder && typeof cfg.sqliteFolder === 'string') {
    sqliteFolderPath = cfg.sqliteFolder;
    return sqliteFolderPath;
  }
  // Default: userData
  sqliteFolderPath = app.getPath('userData');
  return sqliteFolderPath;
}

function setSqliteFolder(folderPath) {
  const safePath = path.normalize(folderPath);
  
  // Save the currently open database to its CURRENT folder FIRST
  if (sqliteDb) {
    try {
      saveSqliteToFile();
      sqliteDb.close();
    } catch {
      // ignore
    }
    sqliteDb = null;
  }

  // NOW update the folder path to the NEW folder
  sqliteFolderPath = safePath;
  const cfg = loadConfig();
  cfg.sqliteFolder = safePath;
  saveConfig(cfg);
}

async function initSqliteLib() {
  if (sqliteLib) return sqliteLib;
  try {
    const initSqlJs = require('sql.js');
    const appPath = app.getAppPath();
    const unpackedPath = path.join(appPath, 'app.asar.unpacked', 'node_modules', 'sql.js', 'dist');
    const asarPath = path.join(appPath, 'node_modules', 'sql.js', 'dist');
    sqliteLib = await initSqlJs({
      locateFile: (file) => {
        const unpacked = path.join(unpackedPath, file);
        if (fs.existsSync(unpacked)) return unpacked;
        return path.join(asarPath, file);
      },
    });
    return sqliteLib;
  } catch (e) {
    sqliteError = e;
    throw e;
  }
}

function saveSqliteToFile() {
  if (!sqliteDb) return;
  const baseFolder = getSqliteFolder();
  const dbPath = path.join(baseFolder, 'jrmd.sqlite');
  try {
    const data = sqliteDb.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  } catch {
    // ignore
  }
}

async function getSqliteDb() {
  if (sqliteDb) return sqliteDb;
  const SQL = await initSqliteLib();
  const baseFolder = getSqliteFolder();
  try {
    if (!fs.existsSync(baseFolder)) {
      fs.mkdirSync(baseFolder, { recursive: true });
    }
  } catch {
    // ignore
  }
  const dbPath = path.join(baseFolder, 'jrmd.sqlite');
  if (fs.existsSync(dbPath)) {
    const buf = fs.readFileSync(dbPath);
    sqliteDb = new SQL.Database(buf);
  } else {
    sqliteDb = new SQL.Database();
  }
  const tables = [
    'suppliers', 'customers', 'payments', 'customerPayments', 'governmentFinalizedPayments',
    'ledgerAccounts', 'ledgerEntries', 'ledgerCashAccounts', 'incomes', 'expenses', 'transactions',
    'banks', 'bankBranches', 'bankAccounts', 'supplierBankAccounts', 'loans', 'fundTransactions',
    'mandiReports', 'employees', 'payroll', 'attendance',
    'inventoryItems', 'inventoryAddEntries', 'kantaParchi', 'customerDocuments',
    'projects', 'options', 'settings', 'incomeCategories', 'expenseCategories', 'accounts',
    'manufacturingCosting', 'expenseTemplates',
  ];
  for (const t of tables) {
    sqliteDb.run(
      `CREATE TABLE IF NOT EXISTS ${t} (id TEXT PRIMARY KEY, data TEXT NOT NULL)`
    );
  }
  sqliteDb.run("PRAGMA auto_vacuum = FULL;");
  return sqliteDb;
}

// --- Register IPC handlers FIRST (before any async code) ---
const BIZSUITE_REL_PATHS = [
  'Entry/suppliers.xlsx', 'Entry/customers.xlsx', 'Entry/inventory-items.xlsx',
  'Payments/supplier-payments.xlsx', 'Payments/customer-payments.xlsx', 'Payments/ledger-accounts.xlsx',
  'Payments/ledger-entries.xlsx', 'Payments/ledger-cash-accounts.xlsx', 'Payments/expenses.xlsx', 'Payments/incomes.xlsx',
  'CashAndBank/banks.xlsx', 'CashAndBank/bank-branches.xlsx', 'CashAndBank/bank-accounts.xlsx', 'CashAndBank/supplier-bank-accounts.xlsx',
  'Reports/mandi-reports.xlsx', 'HR/employees.xlsx', 'HR/payroll.xlsx', 'HR/attendance.xlsx',
  'Projects/projects.xlsx', 'Settings/settings.xlsx'
];

function buildFolderPaths(folderPath) {
  const folderNorm = path.normalize(folderPath).replace(/\/$/, '');
  let folder = folderNorm;
  try {
    folder = fs.realpathSync(folderNorm);
  } catch { /* ignore */ }
  const folders = [folder];
  if (folderNorm !== folder) folders.push(folderNorm);
  try {
    const out = execSync(`cmd /c for %%A in ("${folder.replace(/"/g, '""')}") do @echo %%~sA`, { encoding: 'utf8', windowsHide: true });
    const s = out.trim();
    if (s && s !== folder) folders.push(s);
  } catch { /* ignore */ }
  return [...new Set(folders)];
}

ipcMain.handle('folder:debugExcelPaths', async (_, folderPath) => {
  if (process.platform !== 'win32') return { excelRunning: false, paths: [], folders: [] };
  const folders = folderPath ? buildFolderPaths(folderPath) : [];
  const psPath = path.join(app.getPath('temp'), `bizsuite-excel-debug-${Date.now()}.ps1`);
  const foldersJson = JSON.stringify(folders);
  const ps = `
$folders=${foldersJson}
$xl=$null
try{$xl=[Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")}catch{}
if(-not$xl){@{excelRunning=$false;paths=@();folders=$folders}|ConvertTo-Json;exit}
$paths=@($xl.Workbooks|%{$_.FullName})
@{excelRunning=$true;paths=$paths;folders=$folders}|ConvertTo-Json
`.trim();
  try {
    fs.writeFileSync(psPath, ps, 'utf8');
    const out = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${psPath}"`, { encoding: 'utf8', windowsHide: true, timeout: 10000 });
    try { fs.unlinkSync(psPath); } catch {}
    return JSON.parse(out.trim());
  } catch (e) {
    try { fs.unlinkSync(psPath); } catch {}
    return { excelRunning: false, paths: [], folders };
  }
});

ipcMain.handle('folder:closeExcelFilesInFolder', async (_, folderPath) => {
  if (!folderPath || typeof folderPath !== 'string') return { ok: false };
  if (process.platform === 'win32') {
    const folders = buildFolderPaths(folderPath);
    const allowedPaths = [...new Set(folders.flatMap((f) =>
      BIZSUITE_REL_PATHS.map((r) => path.join(f, r).replace(/\//g, '\\'))
    ))];
    const escape = (s) => String(s).replace(/"/g, '""');
    const tempDir = app.getPath('temp');
    const vbsPath = path.join(tempDir, `bizsuite-close-excel-${Date.now()}.vbs`);
    const pathVars = allowedPaths.map((_, j) => `p${j}`);
    const pathAssigns = allowedPaths.map((p, j) => `p${j} = LCase(Replace("${escape(p)}", "/", Chr(92)))`);
    const matchChecks = allowedPaths.map((_, j) => `(wbPath = p${j})`);
    const matchExpr = matchChecks.join(' Or ');
    const vbs = [
      'On Error Resume Next',
      `Dim xl, wb, wbPath, ${pathVars.join(', ')}, toClose(), i, closed, match`,
      ...pathAssigns,
      'Set xl = GetObject(, "Excel.Application")',
      'If Err.Number <> 0 Then',
      '  WScript.Echo 0',
      '  WScript.Quit',
      'End If',
      'xl.DisplayAlerts = False',
      'ReDim toClose(xl.Workbooks.Count - 1)',
      'i = 0',
      'For Each wb In xl.Workbooks',
      '  wbPath = LCase(Replace(wb.FullName, "/", Chr(92)))',
      `  match = ${matchExpr}`,
      '  If match Then',
      '    Set toClose(i) = wb',
      '    i = i + 1',
      '  End If',
      'Next',
      'closed = 0',
      'For i = 0 To UBound(toClose)',
      '  If Not IsEmpty(toClose(i)) And Not toClose(i) Is Nothing Then',
      '    On Error Resume Next',
      '    toClose(i).Saved = True',
      '    toClose(i).Close False',
      '    closed = closed + 1',
      '  End If',
      'Next',
      'xl.DisplayAlerts = True',
      'Set xl = Nothing',
      'WScript.Echo closed'
    ].filter(Boolean).join('\n');
    const runVbs = () => new Promise((resolve) => {
      exec(`cscript //nologo "${vbsPath}"`, { timeout: 30000 }, (err, stdout) => {
        try { fs.unlinkSync(vbsPath); } catch {}
        const n = parseInt(String(stdout || '0').trim(), 10);
        resolve(isNaN(n) ? 0 : n);
      });
    });
    const runPs = () => new Promise((resolve) => {
      const psPath = path.join(tempDir, `bizsuite-close-excel-${Date.now()}.ps1`);
      const ps = `
$allowed = ${JSON.stringify(allowedPaths.map((p) => p.toLowerCase().replace(/\//g, '\\')))}
$closed = 0
try {
  $xl = [Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
  $xl.DisplayAlerts = $false
  foreach ($wb in @($xl.Workbooks)) {
    $p = $wb.FullName.ToLower().Replace("/", "\\\\")
    if ($allowed -contains $p) {
      try { $wb.Saved = $true } catch {}
      $wb.Close($false)
      $closed++
    }
  }
} catch {}
if ($xl) { $xl.DisplayAlerts = $true }
Write-Output $closed
`.trim();
      try {
        fs.writeFileSync(psPath, ps, 'utf8');
        exec(`powershell -NoProfile -ExecutionPolicy Bypass -File "${psPath}"`, { timeout: 30000, windowsHide: true }, (_, stdout) => {
          try { fs.unlinkSync(psPath); } catch {}
          resolve(parseInt(String(stdout || '0').trim(), 10) || 0);
        });
      } catch {
        try { fs.unlinkSync(psPath); } catch {}
        resolve(0);
      }
    });
    try {
      fs.writeFileSync(vbsPath, vbs.trim(), 'utf8');
      let totalClosed = 0;
      for (let attempt = 0; attempt < 5; attempt++) {
        let closed = await runPs();
        if (closed === 0) {
          fs.writeFileSync(vbsPath, vbs.trim(), 'utf8');
          closed = await runVbs();
        }
        totalClosed += closed;
        if (closed === 0) break;
        await new Promise((r) => setTimeout(r, 300));
      }
      try { fs.unlinkSync(vbsPath); } catch {}
      return { ok: true, closed: totalClosed };
    } catch {
      return { ok: false };
    }
  }
  return { ok: false };
});

function createWindow(loadingOnly = false) {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true,
    },
    icon: path.join(__dirname, '../PUBLIC/icon-512.png'),
    show: false,
    backgroundColor: '#0f172a',
  });
  mainWindow.__loadingOnly = loadingOnly;

  const showAndFocus = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.setVisibleOnAllWorkspaces?.(true);
      mainWindow.focus();
      mainWindow.setAlwaysOnTop(true);
      mainWindow.setAlwaysOnTop(false);
      mainWindow.setVisibleOnAllWorkspaces?.(false);
      if (mainWindow.moveTop) mainWindow.moveTop();
    }
  };

  mainWindow.once('ready-to-show', () => {
    showAndFocus();
    if (isDev) mainWindow.webContents.openDevTools();
  });

  // Fallback: show window after 2s if ready-to-show never fired (e.g. data: URL / redirect)
  const showFallback = setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      showAndFocus();
    }
  }, 2000);
  mainWindow.once('show', () => clearTimeout(showFallback));

  // Ctrl+Shift+I to open DevTools in production (for debugging blank page)
  mainWindow.webContents.on('before-input-event', (_, input) => {
    if (input.control && input.shift && input.key.toLowerCase() === 'i') {
      mainWindow.webContents.openDevTools();
    }
  });

  mainWindow.webContents.on('did-fail-load', (_, code, desc, url) => {
    if (url && url.startsWith('app://')) {
      try {
        const u = new URL(url);
        const redirectUrl = SERVER_URL + (u.pathname || '/') + u.search;
        mainWindow.loadURL(redirectUrl);
      } catch (e) {
        console.error('[Electron] did-fail-load redirect error:', url, e);
      }
      return;
    }
    if (!isDev && code !== -3) console.error('[Electron] Load failed:', code, desc, url);
  });

  // MUST register before loadURL so we never end up on app://
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('app://')) {
      event.preventDefault();
      try {
        const u = new URL(url);
        const redirectUrl = SERVER_URL + (u.pathname || '/') + u.search;
        mainWindow.loadURL(redirectUrl);
      } catch (e) {
        console.error('[Electron] Failed to redirect app:// URL:', url, e);
      }
    }
  });

  // Load initial page: either static "Starting..." (so Chromium/ICU init before we change cwd) or redirect to app
  const startUrl = (isDev && process.env.ELECTRON_DEV_URL) ? process.env.ELECTRON_DEV_URL : SERVER_URL;
  const safeUrl = startUrl.startsWith('http') ? startUrl : SERVER_URL;
  const startWithQuery = safeUrl.includes('?') ? safeUrl + '&electron=1' : safeUrl + '?electron=1';
  const bootstrapHtml = loadingOnly
    ? `data:text/html;charset=utf-8,${encodeURIComponent(
        '<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0f172a;color:#94a3b8;font-family:system-ui,sans-serif;}</style></head><body>Starting JRMD Studio...</body></html>'
      )}`
    : `data:text/html;charset=utf-8,${encodeURIComponent(
        '<!DOCTYPE html><html><head><script>window.location.replace("' + startWithQuery.replace(/"/g, '\\"') + '");</script></head><body>Loading...</body></html>'
      )}`;
  mainWindow.loadURL(bootstrapHtml);

  // If we ever land on app://, force back to http from main process (more reliable than renderer)
  mainWindow.webContents.on('did-finish-load', () => {
    const url = mainWindow.webContents.getURL();
    if (url && url.startsWith('app://')) {
      try {
        const u = new URL(url);
        const redirectUrl = SERVER_URL + (u.pathname || '/') + u.search;
        mainWindow.loadURL(redirectUrl);
      } catch (e) {
        console.error('[Electron] did-finish-load redirect error:', url, e);
      }
      return;
    }
    // Once real app (Next.js) has loaded, ensure window is visible and in front
    if (url && url.startsWith(SERVER_URL) && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });
}

// This method will be called when Electron has finished initialization
app.whenReady().then(async () => {
  console.log('[Electron] App is ready.');
  console.log('[Electron] isDev:', isDev);
  console.log('[Electron] ELECTRON_DEV_URL:', process.env.ELECTRON_DEV_URL);

  try {
    // Redirect ALL app:// requests to http at the network level (catches document nav, fetch, XHR, etc.)
    // Note: app://* is invalid (empty path); use app://*/ and app://*/*
    session.defaultSession.webRequest.onBeforeRequest(
      { urls: ['app://*/', 'app://*/*'] },
      (details, callback) => {
        try {
          const u = new URL(details.url);
          const redirectUrl = SERVER_URL + (u.pathname || '/') + u.search;
          callback({ redirectURL: redirectUrl });
        } catch (e) {
          console.error('[Electron] webRequest redirect error:', details.url, e);
          callback({});
        }
      }
    );
  } catch (e) {
    console.error('[Electron] webRequest setup error:', e);
  }

  try {
    const { net } = require('electron');
    protocol.handle('app', (request) => {
      try {
        const u = new URL(request.url);
        const targetUrl = SERVER_URL + (u.pathname || '/') + u.search;
        return net.fetch(targetUrl);
      } catch (e) {
        console.error('[Electron] app:// handle error:', e);
        return new Response('Not Found', { status: 404 });
      }
    });
  } catch (e) {
    console.error('[Electron] protocol.handle setup error:', e);
  }

  const useDevUrl = !!process.env.ELECTRON_DEV_URL;
  console.log('[Electron] Startup mode:', useDevUrl ? 'Dev' : 'Production');

  if (!useDevUrl) {
    try {
      // 1. Find a free port
      SERVER_PORT = await findFreePort(3600);
      SERVER_URL = `http://127.0.0.1:${SERVER_PORT}`;
      console.log(`[Electron] Using port: ${SERVER_PORT}`);

      // 2. Initial loading window
      createWindow(true);
      
      // 3. Start server
      let serverExitCode = null;
      nextServerProcess = startNextServer(SERVER_PORT);
      if (nextServerProcess) {
        nextServerProcess.on('exit', (code) => { serverExitCode = code; });
      }
      
      // 4. Wait for server port
      const serverReady = await waitForServer(SERVER_PORT);
      
      if (!serverReady) {
        const detail = serverExitCode !== null 
          ? `Server exited with code ${serverExitCode}. Check server.log in AppData for details.`
          : `Server did not respond on port ${SERVER_PORT} within 60s.`;
        throw new Error(detail);
      }

      // 5. Load the real app
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL(`${SERVER_URL}${SERVER_URL.includes('?') ? '&' : '?'}electron=1`);
      }
    } catch (err) {
      console.error('[Electron] Startup error:', err);
      dialog.showMessageBoxSync({
        type: 'error',
        title: 'Startup Error',
        message: 'The application failed to start.',
        detail: err.message || String(err)
      });
      app.quit();
    }
  } else {
    // Dev mode
    SERVER_URL = process.env.ELECTRON_DEV_URL;
    console.log('[Electron] Loading dev URL:', SERVER_URL);
    setTimeout(() => createWindow(false), 0);
  }

  // F12 or Ctrl+Shift+I to open DevTools in production (for debugging blank page)
  globalShortcut.register('F12', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) win.webContents.toggleDevTools();
  });
  globalShortcut.register('CommandOrControl+Shift+I', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) win.webContents.toggleDevTools();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  globalShortcut.unregisterAll();
  if (nextServerProcess) {
    nextServerProcess.kill();
    nextServerProcess = null;
  }
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
    require('electron').shell.openExternal(navigationUrl);
  });
});

// --- Folder Export/Import IPC ---
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// Retry write when Excel has file open (EBUSY/EACCES/EPERM)
const LOCKED_CODES = ['EBUSY', 'EACCES', 'EPERM'];
async function writeWithRetry(normalizedPath, buffer, maxRetries = 15) {
  const dir = path.dirname(normalizedPath);
  ensureDir(dir);
  for (let i = 0; i < maxRetries; i++) {
    try {
      fs.writeFileSync(normalizedPath, buffer);
      return { success: true };
    } catch (e) {
      const code = e?.code || '';
      if (LOCKED_CODES.includes(code) || e?.message?.includes('locked')) {
        if (i < maxRetries - 1) await new Promise(r => setTimeout(r, 2000));
        else return { success: false, error: 'file_locked', message: 'Excel file open - close it to save' };
      }
      throw e;
    }
  }
  return { success: false, error: 'write_failed' };
}

// Register all folder IPC handlers at load time (before app.whenReady)
ipcMain.handle('folder:select', async () => {
  const win = mainWindow || BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  const result = await dialog.showOpenDialog(win || {}, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Select Data Folder (BizSuiteData)',
  });
  if (result.canceled || !result.filePaths?.length) return null;
  return result.filePaths[0];
});

ipcMain.handle('folder:writeFile', async (_, filePath, base64Data) => {
  const normalizedPath = path.normalize(filePath);
  const buffer = Buffer.from(base64Data || '', 'base64');
  return writeWithRetry(normalizedPath, buffer);
});

ipcMain.handle('folder:readFile', async (_, filePath) => {
  const normalizedPath = path.normalize(filePath);
  if (!fs.existsSync(normalizedPath)) return null;
  const buffer = fs.readFileSync(normalizedPath);
  return buffer.toString('base64');
});

ipcMain.handle('folder:listDir', async (_, dirPath) => {
  const normalizedPath = path.normalize(dirPath);
  if (!fs.existsSync(normalizedPath)) return [];
  return fs.readdirSync(normalizedPath);
});

ipcMain.handle('folder:exists', async (_, filePath) => {
  return fs.existsSync(path.normalize(filePath));
});

// --- File watcher: Excel changes -> notify renderer ---
let folderWatcher = null;

ipcMain.handle('folder:watchFolder', async (_, folderPath) => {
  if (folderWatcher) {
    try { folderWatcher.close(); } catch {}
    folderWatcher = null;
  }
  if (!folderPath || !fs.existsSync(folderPath)) return { ok: false };
  const win = mainWindow || BrowserWindow.getFocusedWindow();
  if (!win?.webContents) return { ok: false };

  try {
    folderWatcher = fs.watch(path.normalize(folderPath), { recursive: true }, (ev, name) => {
      if (name && name.toLowerCase().endsWith('.xlsx')) {
        const fullPath = path.join(folderPath, name);
        const rel = path.relative(folderPath, fullPath).replace(/\\/g, '/');
        win.webContents.send('folder:file-changed', { filePath: fullPath, relativePath: rel });
      }
    });
    return { ok: true };
  } catch {
    return { ok: false };
  }
});

ipcMain.handle('folder:stopWatch', async () => {
  if (folderWatcher) {
    try { folderWatcher.close(); } catch {}
    folderWatcher = null;
  }
  return { ok: true };
});

// --- SQLite IPC: migration + basic queries ---
const SQLITE_ALLOWED_TABLES = new Set([
  'suppliers', 'customers', 'payments', 'customerPayments', 'governmentFinalizedPayments',
  'ledgerAccounts', 'ledgerEntries', 'ledgerCashAccounts', 'incomes', 'expenses', 'transactions',
  'banks', 'bankBranches', 'bankAccounts', 'supplierBankAccounts', 'loans', 'fundTransactions',
  'mandiReports', 'employees', 'payroll', 'attendance',
  'inventoryItems', 'inventoryAddEntries', 'kantaParchi', 'customerDocuments',
  'projects', 'options', 'settings', 'incomeCategories', 'expenseCategories', 'accounts',
  'manufacturingCosting', 'expenseTemplates',
]);

ipcMain.handle('sqlite:importTable', async (_event, tableName, rows) => {
  if (sqliteError) {
    return { success: false, error: sqliteError?.message || 'SQLite not available' };
  }
  if (!SQLITE_ALLOWED_TABLES.has(tableName)) {
    return { success: false, error: 'invalid_table' };
  }
  try {
    const db = await getSqliteDb();
    db.run(`DELETE FROM ${tableName}`);
    const items = rows || [];
    let idx = 0;
    const seen = new Set();
    let inserted = 0;

    db.run('BEGIN TRANSACTION');
    try {
      for (const row of items) {
        if (!row || typeof row !== 'object') continue;
        const id = getRowId(row, tableName, idx);
        idx++;
        const key = String(id).slice(0, 500);
        if (seen.has(key)) continue;
        seen.add(key);
        db.run(
          `INSERT OR REPLACE INTO ${tableName} (id, data) VALUES (?, ?)`,
          [key, JSON.stringify(row)]
        );
        inserted++;
      }
      db.run('COMMIT');
    } catch (err) {
      db.run('ROLLBACK');
      throw err;
    }

    saveSqliteToFile();
    return { success: true, count: inserted };
  } catch (e) {
    return { success: false, error: e?.message || String(e) };
  }
});

function getRowId(row, tableName, idx) {
  // Deterministic fallback ID: hash the row so IDs don't change between runs.
  // This prevents random overwrites and inconsistent counts during migration.
  const stableFallback = () => {
    try {
      const crypto = require('crypto');
      const json = JSON.stringify(row) || '';
      const h = crypto.createHash('sha1').update(json).digest('hex').slice(0, 16);
      return `${tableName}_${h}`;
    } catch {
      return `${tableName}_${idx}`;
    }
  };
  
  let id = (row.id != null && String(row.id).trim() !== '') ? String(row.id).trim() : null;
  
  // Only use true unique identifiers as fallbacks if id is missing
  if (!id) {
    if ((tableName === 'payments' || tableName === 'customerPayments' || tableName === 'governmentFinalizedPayments') && row.paymentId) {
      id = String(row.paymentId).trim();
    } else if (tableName === 'transactions' && row.transactionId) {
      id = String(row.transactionId).trim();
    } else if (tableName === 'loans' && row.loanId) {
      id = String(row.loanId).trim();
    } else if (tableName === 'bankBranches' && row.ifscCode) {
      id = String(row.ifscCode).trim();
    } else if (tableName === 'bankAccounts' || tableName === 'supplierBankAccounts') {
      if (row.accountNumber) id = String(row.accountNumber).trim();
    }
  }

  return (id || stableFallback()).slice(0, 500);
}

ipcMain.handle('sqlite:put', async (_event, tableName, row) => {
  if (sqliteError) return { success: false, error: sqliteError?.message || 'SQLite not available' };
  if (!SQLITE_ALLOWED_TABLES.has(tableName)) return { success: false, error: 'invalid_table' };
  if (!row || typeof row !== 'object') return { success: false, error: 'invalid_row' };
  try {
    const db = await getSqliteDb();
    const id = getRowId(row, tableName, 0);
    db.run(`INSERT OR REPLACE INTO ${tableName} (id, data) VALUES (?, ?)`, [id, JSON.stringify(row)]);
    saveSqliteToFile();
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || String(e) };
  }
});

ipcMain.handle('sqlite:vacuum', async () => {
  if (sqliteError) return { success: false, error: sqliteError?.message || 'SQLite not available' };
  try {
    const db = await getSqliteDb();
    db.run("VACUUM;");
    saveSqliteToFile();
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || String(e) };
  }
});

ipcMain.handle('sqlite:delete', async (_event, tableName, id) => {
  if (sqliteError) return { success: false, error: sqliteError?.message || 'SQLite not available' };
  if (!SQLITE_ALLOWED_TABLES.has(tableName)) return { success: false, error: 'invalid_table' };
  if (!id || typeof id !== 'string') return { success: false, error: 'invalid_id' };
  try {
    const db = await getSqliteDb();
    db.run(`DELETE FROM ${tableName} WHERE id = ?`, [String(id).slice(0, 500)]);
    saveSqliteToFile();
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || String(e) };
  }
});

ipcMain.handle('sqlite:all', async (_event, tableName) => {
  if (sqliteError) {
    return [];
  }
  if (!SQLITE_ALLOWED_TABLES.has(tableName)) {
    return [];
  }
  try {
    const db = await getSqliteDb();
    const result = db.exec(`SELECT id, data FROM ${tableName}`);
    if (!result.length || !result[0].values) return [];
    const cols = result[0].columns;
    const idIdx = cols.indexOf('id');
    const dataIdx = cols.indexOf('data');
    return result[0].values.map((row) => ({
      ...(JSON.parse(row[dataIdx] || '{}')),
      // Ensure primary key `id` always comes from SQLite row id (don't let JSON overwrite it)
      id: row[idIdx],
    }));
  } catch {
    return [];
  }
});

ipcMain.handle('sqlite:getFolder', async () => {
  try {
    if (sqliteError) {
      return { folder: null, error: sqliteError?.message || 'SQLite not available' };
    }
    const folder = getSqliteFolder();
    return { folder };
  } catch (e) {
    return { folder: null, error: e?.message || String(e) };
  }
});

ipcMain.handle('sqlite:getFileSize', async () => {
  try {
    const folder = getSqliteFolder();
    if (!folder) return { size: 0 };
    const dbPath = path.join(folder, 'jrmd.sqlite');
    if (fs.existsSync(dbPath)) {
      const stats = fs.statSync(dbPath);
      return { size: stats.size };
    }
    return { size: 0 };
  } catch (e) {
    return { size: 0, error: e?.message || String(e) };
  }
});

ipcMain.handle('sqlite:setFolder', async (_event, folderPath) => {
  if (!folderPath || typeof folderPath !== 'string') {
    return { success: false, error: 'invalid_path' };
  }
  try {
    if (sqliteError) {
      return { success: false, error: sqliteError?.message || 'SQLite not available' };
    }
    setSqliteFolder(folderPath);
    return { success: true, folder: sqliteFolderPath };
  } catch (e) {
    return { success: false, error: e?.message || String(e) };
  }
});
