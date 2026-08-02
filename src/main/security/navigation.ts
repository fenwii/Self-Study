import type { BrowserWindow } from 'electron';

const allowedSchemes = new Set(['https:']);

export function hardenNavigation(window: BrowserWindow): void {
  window.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (allowedSchemes.has(parsed.protocol)) {
        void import('electron').then(({ shell }) => shell.openExternal(url));
      }
    } catch {
      // Invalid URLs are denied.
    }
    return { action: 'deny' };
  });

  window.webContents.on('will-navigate', (event, url) => {
    const current = window.webContents.getURL();
    if (url !== current) event.preventDefault();
  });

  window.webContents.on('will-attach-webview', (event) => {
    event.preventDefault();
  });
}
