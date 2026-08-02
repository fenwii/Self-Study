import type { DesktopApi } from '../shared/contracts';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

declare global {
  interface Window {
    selfStudy: DesktopApi;
  }
}

export {};
