const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const { spawn } = require('child_process');

let mainWindow;
let nextServer;

function createWindow() {
  // Create the browser window
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
    show: false, // Don't show until ready
    backgroundColor: '#000000',
  });

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Focus on window
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  });

  // Load the app
  let startUrl;
  if (isDev) {
    startUrl = 'http://localhost:3000';
  } else {
    // Try to load from static export first
    const staticPath = path.join(__dirname, '../out/index.html');
    if (require('fs').existsSync(staticPath)) {
      startUrl = `file://${staticPath}`;
    } else {
      // Fallback to Next.js server
      startUrl = 'http://localhost:3000';
    }
  }

  mainWindow.loadURL(startUrl);

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

// Start Next.js server in production
function startNextServer() {
  if (!isDev) {
    const nextPath = path.join(__dirname, '../node_modules/.bin/next');
    nextServer = spawn('node', [nextPath, 'start'], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, PORT: '3000' },
    });

    nextServer.stdout.on('data', (data) => {
      console.log(`Next.js: ${data}`);
    });

    nextServer.stderr.on('data', (data) => {
      console.error(`Next.js Error: ${data}`);
    });
  }
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  startNextServer();
  
  // Wait a bit for Next.js to start in production
  setTimeout(() => {
    createWindow();
  }, isDev ? 0 : 3000);

  app.on('activate', () => {
    // On macOS, re-create window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  // On macOS, keep app running even when all windows are closed
  if (process.platform !== 'darwin') {
    if (nextServer) {
      nextServer.kill();
    }
    app.quit();
  }
});

app.on('before-quit', () => {
  if (nextServer) {
    nextServer.kill();
  }
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
    require('electron').shell.openExternal(navigationUrl);
  });
});

