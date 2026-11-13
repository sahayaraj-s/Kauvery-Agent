const { app, BrowserWindow, ipcMain, screen, globalShortcut, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');

let mainWindow = null;
let isExpanded = false;
let pythonProcess = null;

function ensurePythonBackend() {
  // If running via dev concurrently script, concurrently already manages server.py
  if (process.argv.includes('--dev')) {
    console.log('[Main] Dev mode detected: Server lifecycle managed by dev runner.');
    return;
  }

  const req = http.get('http://127.0.0.1:8000/api/health', (res) => {
    if (res.statusCode === 200) {
      console.log('[Main] Python backend is already running on port 8000.');
    }
  });

  req.on('error', () => {
    console.log('[Main] Python backend not detected on port 8000. Launching server.py...');
    try {
      pythonProcess = spawn('python', ['server.py'], {
        cwd: __dirname,
        stdio: 'inherit',
        shell: true,
      });
      pythonProcess.on('error', (err) => {
        console.error('[Main] Failed to start Python server.py:', err);
      });
    } catch (err) {
      console.error('[Main] Error spawning python:', err);
    }
  });

  req.setTimeout(800, () => {
    req.destroy();
  });
}

// Compact, well-proportioned dimensions with ample breathing room for large wings & animations
const COLLAPSED_SIZE = { width: 250, height: 260 }; // Generous room so large wings never cut off
const EXPANDED_SIZE = { width: 400, height: 600 };   // Medium compact assistant size, fits comfortably on any screen

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: sW, height: sH } = primaryDisplay.workAreaSize;

  // Initial position: Bottom right corner with comfortable margin above taskbar
  const initialX = sW - COLLAPSED_SIZE.width - 24;
  const initialY = sH - COLLAPSED_SIZE.height - 24;

  mainWindow = new BrowserWindow({
    width: COLLAPSED_SIZE.width,
    height: COLLAPSED_SIZE.height,
    x: initialX,
    y: initialY,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    resizable: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      backgroundThrottling: false,
    },
  });

  mainWindow.setAlwaysOnTop(true, 'screen-saver');

  // Check dev server vs built dist
  const indexPath = path.join(__dirname, 'dist', 'index.html');
  const isDevMode = process.argv.includes('--dev') || (!fs.existsSync(indexPath) && !app.isPackaged);

  if (isDevMode) {
    const devUrl = 'http://localhost:5173';
    const tryLoad = (retries = 30) => {
      mainWindow.loadURL(devUrl).catch((err) => {
        if (retries > 0) {
          console.log(`[Main] Waiting for Vite server at ${devUrl} (${retries} attempts remaining)...`);
          setTimeout(() => tryLoad(retries - 1), 1000);
        } else {
          console.warn(`[Main] Could not connect to Vite server at ${devUrl}. Loading dist fallback if available.`);
          if (fs.existsSync(indexPath)) {
            mainWindow.loadFile(indexPath);
          }
        }
      });
    };
    tryLoad(30);
  } else {
    mainWindow.loadFile(indexPath);
  }

  // Register Global Hotkeys: Alt+K and Ctrl+Shift+K
  try {
    globalShortcut.register('CommandOrControl+Shift+K', () => {
      if (!mainWindow) return;
      mainWindow.webContents.send('shortcut-toggle');
    });

    globalShortcut.register('Alt+K', () => {
      if (!mainWindow) return;
      mainWindow.webContents.send('shortcut-toggle');
    });
  } catch (err) {
    console.warn('Global shortcut registration note:', err);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Window Expand IPC: Expand smoothly while keeping bottom-right anchor pinned
ipcMain.on('window-expand', (event, { width = EXPANDED_SIZE.width, height = EXPANDED_SIZE.height } = {}) => {
  if (!mainWindow) return;
  const [currentX, currentY] = mainWindow.getPosition();
  const [currentW, currentH] = mainWindow.getSize();

  // Pin right and bottom edge
  const rightAnchor = currentX + currentW;
  const bottomAnchor = currentY + currentH;

  const currentDisplay = screen.getDisplayNearestPoint({ x: currentX, y: currentY });
  const { width: sW, height: sH, x: sX, y: sY } = currentDisplay.workArea;

  let newX = rightAnchor - width;
  let newY = bottomAnchor - height;

  // Clamping within workArea so it never goes off-screen
  if (newX < sX + 16) newX = sX + 16;
  if (newY < sY + 16) newY = sY + 16;
  if (newX + width > sX + sW - 16) newX = sX + sW - width - 16;
  if (newY + height > sY + sH - 16) newY = sY + sH - height - 16;

  mainWindow.setBounds({
    x: Math.round(newX),
    y: Math.round(newY),
    width: Math.round(width),
    height: Math.round(height),
  });

  isExpanded = true;
});

// Window Collapse IPC: Collapse back to floating mini robot
ipcMain.on('window-collapse', () => {
  if (!mainWindow) return;
  const [currentX, currentY] = mainWindow.getPosition();
  const [currentW, currentH] = mainWindow.getSize();

  const rightAnchor = currentX + currentW;
  const bottomAnchor = currentY + currentH;

  const newX = rightAnchor - COLLAPSED_SIZE.width;
  const newY = bottomAnchor - COLLAPSED_SIZE.height;

  mainWindow.setBounds({
    x: Math.round(newX),
    y: Math.round(newY),
    width: COLLAPSED_SIZE.width,
    height: COLLAPSED_SIZE.height,
  });

  isExpanded = false;
});

ipcMain.on('window-resize', (event, { width, height }) => {
  if (!mainWindow) return;
  const [x, y] = mainWindow.getPosition();
  mainWindow.setBounds({ x, y, width: Math.round(width), height: Math.round(height) });
});

// Smooth Dragging handler
ipcMain.on('window-drag', (event, { movementX, movementY }) => {
  if (!mainWindow) return;
  const [x, y] = mainWindow.getPosition();
  mainWindow.setPosition(Math.round(x + movementX), Math.round(y + movementY));
});

ipcMain.on('window-minimize', () => {
  if (!mainWindow) return;
  if (isExpanded) {
    mainWindow.webContents.send('shortcut-toggle');
  } else {
    mainWindow.minimize();
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.on('window-toggle-top', (event, always) => {
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(always, 'screen-saver');
  }
});

ipcMain.on('open-external', (event, url) => {
  if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
    shell.openExternal(url);
  }
});

// File export handler: Saves generated CSV/Excel directly to Downloads and shows in explorer
ipcMain.handle('save-exported-file', async (event, { filename, content, type }) => {
  try {
    const downloadsPath = app.getPath('downloads');
    const safeName = filename || `Kauvery_Agent_Export_${Date.now()}.${type === 'csv' ? 'csv' : 'xlsx'}`;
    const filePath = path.join(downloadsPath, safeName);

    fs.writeFileSync(filePath, content, 'utf8');
    shell.showItemInFolder(filePath);

    return { success: true, filePath, filename: safeName };
  } catch (error) {
    console.error('File export error:', error);
    return { success: false, error: error.message };
  }
});

app.whenReady().then(() => {
  ensurePythonBackend();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (pythonProcess) {
    try {
      pythonProcess.kill();
    } catch (e) {}
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
