import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

vi.mock('electron', () => ({ app: { getPath: () => os.tmpdir() } }));

const temporaryDirectories: string[] = [];
afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

describe('V0.5 independent goal conversations', () => {
  it('keeps messages, counts and previews isolated by goal', async () => {
    const [{ AppDatabase }, { LearningService }] = await Promise.all([
      import('../src/main/db/database'),
      import('../src/main/services/learning-service')
    ]);
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'self-study-v05-conversation-'));
    temporaryDirectories.push(directory);
    const database = new AppDatabase(path.join(directory, 'self-study.db'));
    const learning = new LearningService(database, { list: () => [] } as never);
    const workspace = learning.getDefaultWorkspace();
    const first = learning.createGoal({ workspaceId: workspace.id, title: '目标一', description: '', desiredOutcome: '成果一' });
    const second = learning.createGoal({ workspaceId: workspace.id, title: '目标二', description: '', desiredOutcome: '成果二' });

    learning.createMessage({ workspaceId: workspace.id, goalId: first.id, role: 'user', content: '只属于目标一' });
    learning.createMessage({ workspaceId: workspace.id, goalId: second.id, role: 'user', content: '只属于目标二' });

    const snapshot = learning.dashboard();
    expect(snapshot.messages.filter((item) => item.goalId === first.id).some((item) => item.content === '只属于目标二')).toBe(false);
    expect(snapshot.messages.filter((item) => item.goalId === second.id).some((item) => item.content === '只属于目标一')).toBe(false);
    expect(snapshot.conversations.find((item) => item.goalId === first.id)?.lastMessagePreview).toBe('只属于目标一');
    expect(snapshot.conversations.find((item) => item.goalId === second.id)?.messageCount).toBe(1);
    database.close();
  });

  it('moves the temporary creation run into the newly created goal conversation', async () => {
    const [{ AppDatabase }, { LearningService }] = await Promise.all([
      import('../src/main/db/database'),
      import('../src/main/services/learning-service')
    ]);
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'self-study-v05-attach-'));
    temporaryDirectories.push(directory);
    const database = new AppDatabase(path.join(directory, 'self-study.db'));
    const learning = new LearningService(database, { list: () => [] } as never);
    const workspace = learning.getDefaultWorkspace();
    const general = learning.ensureConversation(workspace.id);
    const runId = 'create-run';
    const timestamp = new Date().toISOString();
    database.db.prepare(`
      INSERT INTO agent_runs (id, workspace_id, goal_id, conversation_id, status, user_input, intent, composition_json, plan_json, current_step, cost_cny, created_at, updated_at)
      VALUES (?, ?, NULL, ?, 'running', '新目标', 'create-goal', '{}', '{"steps":[],"objective":"","rationale":"","expectedEvidence":[],"stopConditions":[]}', 0, 0, ?, ?)
    `).run(runId, workspace.id, general.id, timestamp, timestamp);
    learning.createMessage({ workspaceId: workspace.id, conversationId: general.id, runId, role: 'user', content: '创建一个新目标' });
    const goal = learning.createGoal({ workspaceId: workspace.id, title: '新目标', description: '', desiredOutcome: '真实成果' });
    const conversation = learning.attachRunToGoal(runId, workspace.id, goal.id);
    const moved = database.db.prepare('SELECT goal_id, conversation_id FROM messages WHERE run_id = ?').get(runId) as { goal_id: string; conversation_id: string };
    expect(moved.goal_id).toBe(goal.id);
    expect(moved.conversation_id).toBe(conversation.id);
    database.close();
  });
});
