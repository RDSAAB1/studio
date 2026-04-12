// Preload script - runs in renderer process before web content loads
// This bridge allows safe communication between renderer and main process

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the APIs safely
// Forward folder:file-changed from main to renderer via custom event
ipcRenderer.on('folder:file-changed', (_, data) => {
  window.dispatchEvent(new CustomEvent('folder:file-changed', { detail: data }));
});

ipcRenderer.on('sqlite:backend-change', (_, data) => {
  window.dispatchEvent(new CustomEvent('sqlite-change', { detail: data?.table || 'all' }));
});

// Extra guard: ensure renderer is always recognized as Electron, even if URL param sync fails.
try { window.__ELECTRON__ = true; } catch {}

// Override navigator.onLine to always return true.
// Firebase Auth SDK explicitly checks this and immediately throws auth/network-request-failed
// if it evaluates to false, which is a known bug in Electron environments with virtual network adapters.
Object.defineProperty(navigator, 'onLine', { get: () => true });

contextBridge.exposeInMainWorld('electron', {
  /** Base URL for Next.js server - use this for navigation to avoid app:// protocol bug */
  appUrl: 'http://localhost:3000',
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
  // Folder export/import (Electron only)
  selectFolder: () => ipcRenderer.invoke('folder:select'),
  writeFileToFolder: (filePath, base64Data) => ipcRenderer.invoke('folder:writeFile', filePath, base64Data),
  readFileFromFolder: (filePath) => ipcRenderer.invoke('folder:readFile', filePath),
  listFolder: (dirPath) => ipcRenderer.invoke('folder:listDir', dirPath),
  fileExists: (filePath) => ipcRenderer.invoke('folder:exists', filePath),
  watchFolder: (folderPath) => ipcRenderer.invoke('folder:watchFolder', folderPath),
  stopWatchFolder: () => ipcRenderer.invoke('folder:stopWatch'),
  closeExcelFilesInFolder: (folderPath) => ipcRenderer.invoke('folder:closeExcelFilesInFolder', folderPath),
  debugExcelPaths: (folderPath) => ipcRenderer.invoke('folder:debugExcelPaths', folderPath),
  // SQLite migration / basic access
  sqliteImportTable: (tableName, rows) => ipcRenderer.invoke('sqlite:importTable', tableName, rows),
  sqliteBulkPut: (tableName, rows, options) => ipcRenderer.invoke('sqlite:bulkPut', tableName, rows, options),
  sqliteAll: (tableName) => ipcRenderer.invoke('sqlite:all', tableName),
  sqliteGet: (tableName, id) => ipcRenderer.invoke('sqlite:get', tableName, id),
  sqlitePut: (tableName, row, options) => ipcRenderer.invoke('sqlite:put', tableName, row, options),
  sqliteDelete: (tableName, id, options) => ipcRenderer.invoke('sqlite:delete', tableName, id, options),
  sqliteBulkDelete: (tableName, ids) => ipcRenderer.invoke('sqlite:bulkDelete', tableName, ids),
  sqliteQuery: (tableName, options) => ipcRenderer.invoke('sqlite:query', tableName, options),
  sqliteCount: (tableName) => ipcRenderer.invoke('sqlite:count', tableName),
  sqliteGetFolder: () => ipcRenderer.invoke('sqlite:getFolder'),
  sqliteSetFolder: (folderPath) => ipcRenderer.invoke('sqlite:setFolder', folderPath),
  sqliteVacuum: () => ipcRenderer.invoke('sqlite:vacuum'),
  sqliteGetFileSize: () => ipcRenderer.invoke('sqlite:getFileSize'),
  sqliteSelectFile: () => ipcRenderer.invoke('sqlite:selectFile'),
  sqliteReadExternalTable: (filePath, tableName) => ipcRenderer.invoke('sqlite:readExternalTable', filePath, tableName),
  // Window controls (for frameless window)
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  // Native print
  printHtml: (htmlContent, options) => ipcRenderer.invoke('print:html', htmlContent, options),
  // Database utilities
  sqliteClearAllTables: (options) => ipcRenderer.invoke('sqlite:clearAllTables', options),
});




















