// Preload script - runs in renderer process before web content loads
// This bridge allows safe communication between renderer and main process

const { contextBridge } = require('electron');

// Expose protected methods that allow the renderer process to use
// the APIs safely
contextBridge.exposeInMainWorld('electron', {
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
});














