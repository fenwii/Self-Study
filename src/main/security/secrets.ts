import { safeStorage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

interface SecretStoreData {
  version: 1;
  values: Record<string, string>;
}

export class SecretStore {
  private readonly filePath: string;

  constructor() {
    this.filePath = path.join(app.getPath('userData'), 'secrets.json');
  }

  set(key: string, value: string): void {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('当前操作系统无法提供安全密钥存储，请启用系统钥匙串后重试。');
    }
    const data = this.read();
    data.values[key] = safeStorage.encryptString(value).toString('base64');
    this.write(data);
  }

  get(key: string): string | undefined {
    const encrypted = this.read().values[key];
    if (!encrypted) return undefined;
    if (!safeStorage.isEncryptionAvailable()) return undefined;
    return safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
  }

  delete(key: string): void {
    const data = this.read();
    delete data.values[key];
    this.write(data);
  }

  private read(): SecretStoreData {
    if (!fs.existsSync(this.filePath)) return { version: 1, values: {} };
    try {
      return JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as SecretStoreData;
    } catch {
      return { version: 1, values: {} };
    }
  }

  private write(data: SecretStoreData): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(data, null, 2), { mode: 0o600 });
    fs.renameSync(temporary, this.filePath);
  }
}
