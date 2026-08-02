import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

vi.mock('electron', () => ({ app: { getPath: () => os.tmpdir() } }));

const temporaryDirectories: string[] = [];
afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

describe('V0.6 natural interaction persistence', () => {
  it('keeps drafts isolated and clears only the sent conversation draft', async () => {
    const [{ AppDatabase }, { LearningService }] = await Promise.all([
      import('../src/main/db/database'),
      import('../src/main/services/learning-service')
    ]);
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'self-study-v06-drafts-'));
    temporaryDirectories.push(directory);
    const database = new AppDatabase(path.join(directory, 'self-study.db'));
    const learning = new LearningService(database, { list: () => [] } as never);
    const workspace = learning.getDefaultWorkspace();
    const first = learning.createGoal({ workspaceId: workspace.id, title: '目标一', description: '', desiredOutcome: '成果一' });
    const second = learning.createGoal({ workspaceId: workspace.id, title: '目标二', description: '', desiredOutcome: '成果二' });
    const firstConversation = learning.ensureConversation(workspace.id, first.id);
    const secondConversation = learning.ensureConversation(workspace.id, second.id);

    learning.saveConversationDraft(firstConversation.id, '目标一草稿 $x^2$');
    learning.saveConversationDraft(secondConversation.id, '目标二草稿');
    learning.createMessage({ workspaceId: workspace.id, goalId: first.id, role: 'user', content: '发送目标一' });

    const snapshot = learning.dashboard();
    expect(snapshot.conversations.find((item) => item.id === firstConversation.id)?.draft).toBe('');
    expect(snapshot.conversations.find((item) => item.id === secondConversation.id)?.draft).toBe('目标二草稿');
    database.close();
  });

  it('renames, pins, archives and restores the same goal conversation without deleting history', async () => {
    const [{ AppDatabase }, { LearningService }] = await Promise.all([
      import('../src/main/db/database'),
      import('../src/main/services/learning-service')
    ]);
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'self-study-v06-lifecycle-'));
    temporaryDirectories.push(directory);
    const database = new AppDatabase(path.join(directory, 'self-study.db'));
    const learning = new LearningService(database, { list: () => [] } as never);
    const workspace = learning.getDefaultWorkspace();
    const goal = learning.createGoal({ workspaceId: workspace.id, title: '原目标', description: '', desiredOutcome: '成果' });
    const conversation = learning.ensureConversation(workspace.id, goal.id);
    learning.createMessage({ workspaceId: workspace.id, goalId: goal.id, role: 'user', content: '永久保留的记录' });

    learning.renameGoal(goal.id, '新目标');
    learning.pinConversation(conversation.id, true);
    learning.touchConversation(conversation.id);
    learning.archiveGoal(goal.id, true);

    let snapshot = learning.dashboard();
    expect(snapshot.goals.find((item) => item.id === goal.id)?.title).toBe('新目标');
    expect(snapshot.conversations.find((item) => item.id === conversation.id)?.title).toBe('新目标');
    expect(snapshot.conversations.find((item) => item.id === conversation.id)?.status).toBe('archived');
    expect(snapshot.conversations.find((item) => item.id === conversation.id)?.pinned).toBe(false);
    expect(snapshot.messages.some((item) => item.content === '永久保留的记录')).toBe(true);

    learning.archiveGoal(goal.id, false);
    learning.pinConversation(conversation.id, true);
    snapshot = learning.dashboard();
    expect(snapshot.goals.find((item) => item.id === goal.id)?.status).toBe('active');
    expect(snapshot.conversations.find((item) => item.id === conversation.id)?.pinned).toBe(true);
    expect(snapshot.conversations.find((item) => item.id === conversation.id)?.lastOpenedAt).toBeTruthy();
    database.close();
  });
});
