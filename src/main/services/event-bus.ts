import type { BrowserWindow } from 'electron';
import type { RunEvent } from '../../shared/domain';
import { IPC } from '../../shared/contracts';

export class AppEventBus {
  private window?: BrowserWindow;

  attach(window: BrowserWindow): void {
    this.window = window;
  }

  emit(event: Omit<RunEvent, 'at'>): void {
    if (!this.window || this.window.isDestroyed()) return;
    this.window.webContents.send(IPC.EVENT, { ...event, at: new Date().toISOString() } satisfies RunEvent);
  }
}
