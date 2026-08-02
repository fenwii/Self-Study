import { app, BrowserWindow, session } from 'electron';
import path from 'node:path';
import { AppDatabase } from './main/db/database';
import { SecretStore } from './main/security/secrets';
import { hardenNavigation } from './main/security/navigation';
import { ProviderService } from './main/services/provider-service';
import { LearningService } from './main/services/learning-service';
import { TraceService } from './main/services/trace-service';
import { AppEventBus } from './main/services/event-bus';
import { ProviderRegistry } from './main/ai/provider-registry';
import { RunManager } from './main/agents/run-manager';
import { registerIpc } from './main/ipc/register-ipc';
import { AppLogger } from './main/services/app-logger';

let mainWindow: BrowserWindow | null = null;
let database: AppDatabase | undefined;
let logger: AppLogger | undefined;
let shuttingDown = false;

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) app.quit();

const createWindow = (): BrowserWindow => {
  const window = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 1120,
    minHeight: 720,
    backgroundColor: '#ffffff',
    title: 'Self-Study AI',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: true,
      devTools: process.env.NODE_ENV !== 'production'
    }
  });

  hardenNavigation(window);
  window.once('ready-to-show', () => window.show());
  window.on('closed', () => {
    if (mainWindow === window) mainWindow = null;
  });
  window.webContents.on('render-process-gone', (_event, details) => {
    logger?.error('renderer.process-gone', details.reason, details);
  });
  window.webContents.on('unresponsive', () => logger?.warn('renderer.unresponsive'));
  window.webContents.on('responsive', () => logger?.info('renderer.responsive'));

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void window.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    void window.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  return window;
};

const shutdown = (): void => {
  if (shuttingDown) return;
  shuttingDown = true;
  try {
    database?.close();
    logger?.info('application.shutdown');
  } catch (error) {
    logger?.error('application.shutdown-failed', error);
  }
};

app.on('second-instance', () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

app.on('web-contents-created', (_event, contents) => {
  contents.on('will-attach-webview', (event) => event.preventDefault());
});

process.on('uncaughtException', (error) => logger?.error('process.uncaught-exception', error));
process.on('unhandledRejection', (reason) => logger?.error('process.unhandled-rejection', reason));

if (hasSingleInstanceLock) {
  void app.whenReady().then(() => {
    logger = new AppLogger();
    logger.info('application.start', { version: app.getVersion(), platform: process.platform, arch: process.arch });

    session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);

    try {
      database = new AppDatabase();
      const secrets = new SecretStore();
      const providers = new ProviderService(database, secrets);
      const learning = new LearningService(database, providers);
      const traces = new TraceService(database);
      const events = new AppEventBus();
      const registry = new ProviderRegistry(providers);
      const runs = new RunManager(database, learning, traces, registry, events);
      runs.recoverInterruptedRuns();
      registerIpc({ learning, providers, runs });

      mainWindow = createWindow();
      events.attach(mainWindow);

      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          mainWindow = createWindow();
          events.attach(mainWindow);
        }
      });
    } catch (error) {
      logger.error('application.bootstrap-failed', error);
      app.quit();
    }
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', shutdown);
app.on('will-quit', shutdown);
