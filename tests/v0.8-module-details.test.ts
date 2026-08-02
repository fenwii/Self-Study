import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('V0.8 complete module lifecycle contracts', () => {
  it('ships Schema V8 and reversible lifecycle fields', () => {
    const pkg = JSON.parse(read('package.json')) as { version: string };
    const domain = read('src/shared/domain.ts');
    const database = read('src/main/db/database.ts');
    expect(Number(pkg.version.split('.')[1])).toBeGreaterThanOrEqual(8);
    const schema = Number(database.match(/const SCHEMA_VERSION = (\d+)/u)?.[1] ?? 0);
    expect(schema).toBeGreaterThanOrEqual(8);
    for (const field of ['completedAt', 'resolvedAt', 'suspendedAt', 'archivedAt', 'MaintenanceSnapshot']) {
      expect(domain).toContain(field);
    }
    expect(database).toContain('PRAGMA integrity_check');
    expect(database).toContain("createBackup(kind: 'daily' | 'manual'");
  });

  it('exposes detail actions only through typed IPC contracts', () => {
    const contracts = read('src/shared/contracts.ts');
    const preload = read('src/preload.ts');
    const ipc = read('src/main/ipc/register-ipc.ts');
    for (const action of [
      'updateGoal', 'updateTask', 'updateMisconception', 'suspendReview',
      'archiveResource', 'archiveAssessment', 'archiveArtifact', 'createBackup', 'restoreBackup'
    ]) {
      expect(preload).toContain(action);
    }
    for (const channel of [
      'LEARNING_GOAL_UPDATE', 'LEARNING_TASK_UPDATE', 'LEARNING_MISCONCEPTION_UPDATE',
      'LEARNING_REVIEW_SUSPEND', 'LEARNING_RESOURCE_ARCHIVE',
      'LEARNING_ASSESSMENT_ARCHIVE', 'LEARNING_ARTIFACT_ARCHIVE',
      'MAINTENANCE_BACKUP_CREATE', 'MAINTENANCE_BACKUP_RESTORE'
    ]) {
      expect(contracts).toContain(channel);
      expect(ipc).toContain(channel);
    }
  });

  it('keeps module actions visible, reversible and locally maintainable', () => {
    const inspector = read('src/app/components/Inspector.tsx');
    const store = read('src/app/store.ts');
    for (const label of ['目标', '任务', '复习', '知识', '资料', '评估', '作品', '证据', '运行']) {
      expect(inspector).toContain(label);
    }
    for (const operation of ['归档', '恢复', '暂停', '本地数据库', '立即创建备份', '查看与恢复备份']) {
      expect(inspector).toContain(operation);
    }
    expect(store).toContain('createBackup');
    expect(store).toContain('archiveArtifact');
  });
});
