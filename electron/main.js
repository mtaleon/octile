const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const isDev = !app.isPackaged;
// Enable debug with: /Applications/Octile.app/Contents/MacOS/Octile --debug
const enableDebug = isDev || process.argv.includes('--debug');

// Steam App ID — set to your actual ID after creating the app on Steamworks
const STEAM_APP_ID = 0; // TODO: replace with real app ID

// Try to initialize Steamworks (fails gracefully if Steam isn't running)
let steamClient = null;
try {
  if (STEAM_APP_ID > 0) {
    const steamworks = require('steamworks.js');
    steamClient = steamworks.init(STEAM_APP_ID);
    console.log('Steamworks initialized');
  }
} catch (e) {
  console.warn('Steamworks not available:', e.message);
}

function getWebAssetPath(file) {
  if (isDev) {
    var webRoot = process.env.ELECTRON_WEB_ROOT || '../dist/web';
    return path.join(__dirname, webRoot, file);
  }
  return path.join(process.resourcesPath, 'app', file);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 540,
    minHeight: 720,
    backgroundColor: '#0b1020',
    useContentSize: true,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Remove menu bar (Steam-friendly)
  if (!isDev) Menu.setApplicationMenu(null);

  // Load local index.html (with friendly error if dist/web/ not built yet)
  var indexPath = getWebAssetPath('index.html');
  if (isDev && !fs.existsSync(indexPath)) {
    win.loadURL('data:text/html,' + encodeURIComponent(
      '<body style="background:#0b1020;color:#ccc;font:16px system-ui;padding:40px;text-align:center">'
      + '<h2>Build required</h2><p>Run <code>./scripts/build.sh</code> from the repo root first.</p>'
      + '<p style="color:#888;font-size:13px">This populates dist/web/ which Electron dev mode reads from.</p></body>'
    ));
  } else {
    win.loadFile(indexPath);
  }

  // Show when ready (no white flash)
  win.once('ready-to-show', () => win.show());

  // Enable DevTools shortcut in dev mode or debug builds (F12 / Cmd+Alt+I)
  if (enableDebug) {
    win.webContents.on('before-input-event', (event, input) => {
      if (input.type === 'keyDown') {
        if (input.key === 'F12' || (input.control && input.shift && input.key === 'I') ||
            (input.meta && input.alt && input.key === 'i')) {
          win.webContents.toggleDevTools();
          event.preventDefault();
        }
      }
    });
  }

  // Block navigation to external URLs — whitelist http(s) only
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://')) {
      e.preventDefault();
      if (/^https?:\/\//.test(url)) shell.openExternal(url);
    }
  });

  // Handle new windows (window.open calls)
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) {
      // External URL — open in system browser
      shell.openExternal(url);
    } else if (url.startsWith('file://')) {
      // Local file (e.g., terms.html, privacy.html) — open in child window
      var child = new BrowserWindow({
        width: 720, height: 600,
        parent: win, modal: false,
        backgroundColor: '#0f1923',
        autoHideMenuBar: true,
        webPreferences: { contextIsolation: true, nodeIntegration: false }
      });
      if (!isDev) Menu.setApplicationMenu(null);
      child.loadURL(url);
    }
    return { action: 'deny' };
  });

  // Disable reload/devtools shortcuts in production
  if (!isDev) {
    win.webContents.on('before-input-event', (e, input) => {
      if (input.key === 'F5' || (input.control && input.key === 'r') ||
          (input.control && input.shift && input.key === 'I') || input.key === 'F12') {
        e.preventDefault();
      }
    });
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (steamClient) {
    try { steamClient.shutdown?.(); } catch (_) {}
  }
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
