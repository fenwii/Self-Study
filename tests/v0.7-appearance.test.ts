import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

vi.mock('electron', () => ({
  app: { getPath: () => os.tmpdir() },
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (value: string) => Buffer.from(value),
    decryptString: (value: Buffer) => value.toString('utf8')
  }
}));

const temporaryDirectories: string[] = [];
afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

describe('V0.7 appearance persistence', () => {
  it('persists readable appearance preferences across database restarts', async () => {
    const [{ AppDatabase }, { LearningService }] = await Promise.all([
      import('../src/main/db/database'),
      import('../src/main/services/learning-service')
    ]);
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'self-study-v07-appearance-'));
    temporaryDirectories.push(directory);
    const databasePath = path.join(directory, 'self-study.db');

    let database = new AppDatabase(databasePath);
    let learning = new LearningService(database, { list: () => [] } as never);
    expect(learning.dashboard().appearance).toEqual({
      theme: 'system', fontScale: 1, density: 'comfortable', readingWidth: 'standard', reduceMotion: false, highContrast: false
    });

    learning.saveAppearancePreferences({
      theme: 'dark', fontScale: 1.1, density: 'compact', readingWidth: 'narrow', reduceMotion: true, highContrast: true
    });
    database.close();

    database = new AppDatabase(databasePath);
    learning = new LearningService(database, { list: () => [] } as never);
    expect(learning.dashboard().appearance).toEqual({
      theme: 'dark', fontScale: 1.1, density: 'compact', readingWidth: 'narrow', reduceMotion: true, highContrast: true
    });
    database.close();
  });
});
