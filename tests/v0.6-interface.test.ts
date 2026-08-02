import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('V0.6 minimalist natural interface contracts', () => {
  it('ships the V0.6 product version and progressive-disclosure layout', () => {
    const pkg = JSON.parse(read('package.json')) as { version: string };
    const app = read('src/app/App.tsx');
    expect(Number(pkg.version.split('.')[1])).toBeGreaterThanOrEqual(6);
    expect(app).toContain('inspector-open');
    expect(app).toContain('focus-mode');
    expect(app).toContain('self-study:focus-composer');
  });

  it('persists per-goal drafts and exposes natural conversation actions', () => {
    const store = read('src/app/store.ts');
    const sidebar = read('src/app/components/Sidebar.tsx');
    const chat = read('src/app/components/ChatPanel.tsx');
    expect(store).toContain('saveDraft');
    expect(store).toContain('renameGoal');
    expect(store).toContain('archiveGoal');
    expect(store).toContain('pinConversation');
    expect(sidebar).toContain('草稿：');
    expect(sidebar).toContain('归档');
    expect(chat).toContain('草稿已自动保存');
    expect(chat).toContain('下一步');
    expect(chat).toContain('Shift+Enter换行');
  });
});
