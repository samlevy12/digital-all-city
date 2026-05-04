// Electron entry — wraps the static SPA in a desktop window.

const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');

const isDev = process.argv.includes('--dev');

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 600,
    minHeight: 420,
    title: 'Digital All City',
    backgroundColor: '#008080',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Hide the native menu — the app has its own Win95 chrome.
  Menu.setApplicationMenu(null);

  win.loadFile(path.join(__dirname, '..', 'index.html'));

  if (isDev) win.webContents.openDevTools({ mode: 'detach' });

  // Open external links in the user's default browser, not inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
