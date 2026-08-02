import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('V1.0 release surface', () => {
  it('ships formal version and Schema V10', () => {
    const pkg = JSON.parse(read('package.json')) as { version: string };
    const database = read('src/main/db/database.ts');
    expect(pkg.version).toBe('1.0.0');
    expect(database).toContain('const SCHEMA_VERSION = 10');
    expect(database).toContain('learning_contracts');
    expect(database).toContain('weekly_learning_reviews');
  });

  it('connects contract features through typed IPC and the desktop UI', () => {
    for (const file of ['src/shared/contracts.ts', 'src/preload.ts', 'src/main/ipc/register-ipc.ts', 'src/app/store.ts']) {
      const source = read(file);
      expect(source).toContain('upsertContract');
      expect(source).toContain('generateWeeklyReview');
    }
    const inspector = read('src/app/components/Inspector.tsx');
    expect(inspector).toContain('一对一学习契约');
    expect(inspector).toContain('正式周复盘');
  });
});
