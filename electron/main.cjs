const { app, BrowserWindow, shell, session } = require('electron');
const path = require('path');

const isDev = !app.isPackaged;
const pkg = require('../package.json');
// `appId` est un champ de premier niveau de package.json : lui seul est embarqué dans l'application.
const appId = pkg.appId || pkg.name;

// Un dossier de données propre à CETTE application (session de connexion, cache) :
// deux applications installées sur le même ordinateur ne se mélangent jamais.
app.setPath('userData', path.join(app.getPath('appData'), appId));
app.setAppUserModelId(appId);

// Une seule fenêtre : relancer l'application ramène la fenêtre existante au premier plan.
if (!isDev && !app.requestSingleInstanceLock()) {
  app.quit();
}

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    show: false,
    backgroundColor: '#f8fafc',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow.removeMenu();
  mainWindow.once('ready-to-show', () => mainWindow && mainWindow.show());
  mainWindow.on('closed', () => {mainWindow = null;});

  // target="_blank" -> navigateur du système (jamais une nouvelle fenêtre Electron).
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  // L'application ne navigue jamais ailleurs que sur ses propres pages.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const own = isDev ? (process.env.ELECTRON_START_URL || 'http://localhost:5173') : 'file://';
    if (!url.startsWith(own)) {
      event.preventDefault();
      if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    }
  });

  if (isDev) {
    mainWindow.loadURL(process.env.ELECTRON_START_URL || 'http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(() => {
  // Aucune permission spéciale (caméra, micro, géolocalisation…) n'est nécessaire.
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
