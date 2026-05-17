import { app, BrowserWindow, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// dist-electron/main.js  →  project root
const APP_ROOT      = path.join(__dirname, '..');
const RENDERER_DIST = path.join(APP_ROOT, 'dist');
const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

process.env.VITE_PUBLIC = DEV_SERVER_URL
  ? path.join(APP_ROOT, 'public')
  : RENDERER_DIST;

let win: BrowserWindow | null = null;

function createWindow() {
  win = new BrowserWindow({
    width:     1280,
    height:    800,
    minWidth:  1024,
    minHeight: 640,
    title:     'Contador SaaS',
    show:      false,               // prevents flash of unstyled content
    webPreferences: {
      preload:          path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration:  false,
      sandbox:          false,
    },
  });

  // Show window only when ready
  win.once('ready-to-show', () => win?.show());

  // Open http(s) links in the default browser — not in Electron
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  if (DEV_SERVER_URL) {
    win.loadURL(DEV_SERVER_URL);
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'));
  }

  win.on('closed', () => { win = null; });
}

// ─── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
    win = null;
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
