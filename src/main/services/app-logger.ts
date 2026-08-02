import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogRecord {
  timestamp: string;
  level: LogLevel;
  event: string;
  message?: string;
  data?: unknown;
}

const MAX_LOG_BYTES = 5 * 1024 * 1024;
const MAX_ARCHIVES = 5;

export class AppLogger {
  private readonly directory: string;
  private readonly filePath: string;

  constructor(directory = path.join(app.getPath('userData'), 'logs')) {
    this.directory = directory;
    this.filePath = path.join(directory, 'self-study.log');
    fs.mkdirSync(directory, { recursive: true });
    this.rotateIfNeeded();
  }

  debug(event: string, data?: unknown): void {
    if (process.env.NODE_ENV !== 'production') this.write({ level: 'debug', event, data });
  }

  info(event: string, data?: unknown): void {
    this.write({ level: 'info', event, data });
  }

  warn(event: string, data?: unknown): void {
    this.write({ level: 'warn', event, data });
  }

  error(event: string, error?: unknown, data?: unknown): void {
    this.write({
      level: 'error',
      event,
      message: error instanceof Error ? error.message : error ? String(error) : undefined,
      data: {
        ...(isRecord(data) ? data : data === undefined ? {} : { value: data }),
        ...(error instanceof Error ? { name: error.name, stack: error.stack } : {})
      }
    });
  }

  private write(record: Omit<LogRecord, 'timestamp'>): void {
    try {
      this.rotateIfNeeded();
      const line = `${JSON.stringify({ timestamp: new Date().toISOString(), ...record }, safeJsonReplacer)}\n`;
      fs.appendFileSync(this.filePath, line, { encoding: 'utf8', mode: 0o600 });
    } catch (error) {
      // Logging must never crash the application. Keep the fallback free of secrets.
      console.error('[Self-Study logger failure]', error instanceof Error ? error.message : String(error));
    }
  }

  private rotateIfNeeded(): void {
    if (!fs.existsSync(this.filePath) || fs.statSync(this.filePath).size < MAX_LOG_BYTES) return;
    for (let index = MAX_ARCHIVES - 1; index >= 1; index -= 1) {
      const source = path.join(this.directory, `self-study.log.${index}`);
      const destination = path.join(this.directory, `self-study.log.${index + 1}`);
      if (fs.existsSync(source)) fs.renameSync(source, destination);
    }
    fs.renameSync(this.filePath, path.join(this.directory, 'self-study.log.1'));
  }
}

function safeJsonReplacer(key: string, value: unknown): unknown {
  if (/api[-_]?key|authorization|secret|token|password/i.test(key)) return '[REDACTED]';
  if (typeof value === 'string' && /\b(?:sk-|Bearer\s+)[A-Za-z0-9._-]{12,}/i.test(value)) return '[REDACTED]';
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
