const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const isDev = !app.isPackaged;

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

  // Block navigation to external URLs — whitelist http(s) only
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://')) {
      e.preventDefault();
      if (/^https?:\/\//.test(url)) shell.openExternal(url);
    }
  });

  // Block new windows — open http(s) in system browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
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
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
