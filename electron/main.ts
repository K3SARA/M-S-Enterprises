import { app, BrowserWindow, ipcMain, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { fork, ChildProcess } from 'child_process';

let mainWindow: BrowserWindow | null = null;
let serverProcess: ChildProcess | null = null;

const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;

function startBackendServer() {
  try {
    const isPackaged = app.isPackaged;
    const appRoot = isPackaged ? app.getAppPath() : path.join(__dirname, '../..');
    const serverScript = isPackaged
      ? path.join(appRoot, 'dist-server/index.js')
      : path.join(__dirname, '../../dist-server/index.js');

    const dbDir = app.getPath('userData');
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    const dbPath = path.join(dbDir, 'distributor.db');

    // Seed initial database if it doesn't exist
    const defaultTemplateDb = isPackaged
      ? path.join(appRoot, 'prisma/distributor.db')
      : path.join(__dirname, '../../prisma/distributor.db');

    if (!fs.existsSync(dbPath) && fs.existsSync(defaultTemplateDb)) {
      try {
        fs.copyFileSync(defaultTemplateDb, dbPath);
        console.log('[Electron] Initialized database from template at:', dbPath);
      } catch (copyErr) {
        console.error('[Electron] Failed to copy template database:', copyErr);
      }
    }

    if (!isDev) {
      serverProcess = fork(serverScript, [], {
        env: {
          ...process.env,
          ELECTRON_RUN_AS_NODE: '1',
          DATABASE_URL: `file:${dbPath}`,
          PORT: '4812'
        }
      });

      serverProcess.on('error', (err) => {
        console.error('Failed to start embedded backend server:', err);
      });
    }
  } catch (err) {
    console.error('Error starting backend server:', err);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 920,
    minWidth: 1080,
    minHeight: 720,
    backgroundColor: '#F1F3F6',
    title: 'M&S Enterprises',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });

  const devUrl = 'http://localhost:5173';
  if (isDev) {
    mainWindow.loadURL(devUrl);
    // mainWindow.webContents.openDevTools();
  } else {
    const indexPath = app.isPackaged
      ? path.join(app.getAppPath(), 'dist/index.html')
      : path.join(__dirname, '../../dist/index.html');
    mainWindow.loadFile(indexPath);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  startBackendServer();
  createWindow();

  // IPC Handlers for native printing
  ipcMain.handle('print-page', async () => {
    if (!mainWindow) return;
    mainWindow.webContents.print({ silent: false, printBackground: true });
  });

  ipcMain.handle('print-to-pdf', async () => {
    if (!mainWindow) return null;
    const pdfData = await mainWindow.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4'
    });
    return pdfData;
  });

  ipcMain.handle('open-external', async (_event, url: string) => {
    await shell.openExternal(url);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});
