// Preload script - runs in renderer process before web content loads
// This bridge allows safe communication between renderer and main process

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the APIs safely
// Forward folder:file-changed from main to renderer via custom event
ipcRenderer.on('folder:file-changed', (_, data) => {
  window.dispatchEvent(new CustomEvent('folder:file-changed', { detail: data }));
});

// Extra guard: ensure renderer is always recognized as Electron, even if URL param sync fails.
try { window.__ELECTRON__ = true; } catch {}

contextBridge.exposeInMainWorld('electron', {
  /** Base URL for Next.js server - use this for navigation to avoid app:// protocol bug */
  appUrl: 'http://127.0.0.1:3000',
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
  sqliteAll: (tableName) => ipcRenderer.invoke('sqlite:all', tableName),
  sqlitePut: (tableName, row) => ipcRenderer.invoke('sqlite:put', tableName, row),
  sqliteDelete: (tableName, id) => ipcRenderer.invoke('sqlite:delete', tableName, id),
  sqliteGetFolder: () => ipcRenderer.invoke('sqlite:getFolder'),
  sqliteSetFolder: (folderPath) => ipcRenderer.invoke('sqlite:setFolder', folderPath),
  sqliteVacuum: () => ipcRenderer.invoke('sqlite:vacuum'),
  sqliteGetFileSize: () => ipcRenderer.invoke('sqlite:getFileSize'),
});



















