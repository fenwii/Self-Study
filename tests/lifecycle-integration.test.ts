import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

vi.mock('electron', () => ({ app: { getPath: () => os.tmpdir() } }));

const temporaryDirectories: string[] = [];
afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

describe('V0.4 SQLite learning lifecycle', () => {
  it('runs path, local library, assessment and artifact acceptance end to end', async () => {
    const [{ AppDatabase }, { LearningService }] = await Promise.all([
      import('../src/main/db/database'),
      import('../src/main/services/learning-service')
    ]);
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'self-study-v04-test-'));
    temporaryDirectories.push(directory);
    const database = new AppDatabase(path.join(directory, 'self-study.db'));
    const learning = new LearningService(database, { list: () => [] } as never);
    const workspace = learning.getDefaultWorkspace();
    const goal = learning.createGoal({
      workspaceId: workspace.id,
      title: '掌握 TypeScript Agent',
      description: '通过项目形成独立工程能力',
      desiredOutcome: '交付可运行智能体',
      currentLevel: 2,
      targetLevel: 5
    });

    const compiled = learning.compileLearningPath({ goalId: goal.id });
    expect(compiled.milestones).toHaveLength(6);
    learning.completeMilestone(compiled.milestones[0]!.id);
    expect(learning.listMilestones([goal.id]).find((item) => item.orderIndex === 1)?.status).toBe('available');

    learning.importResource({
      workspaceId: workspace.id,
      goalId: goal.id,
      title: '状态机笔记.md',
      kind: 'markdown',
      content: 'Agent状态机包含queued、running、paused和completed。检查点用于长程恢复。'
    });
    expect(learning.searchResources(workspace.id, '长程智能体状态机如何恢复', goal.id).length).toBeGreaterThan(0);

    const assessment = learning.createAssessment({ goalId: goal.id, topic: 'Agent状态机' });
    const attempt = learning.submitAssessment(assessment.id, ('核心机制与因果关系；独立例子；迁移场景与可迁移结构；边界；常见误解；反例或实验；判断标准。\n').repeat(12));
    expect(attempt.score).toBeGreaterThan(0.6);

    const artifact = learning.createArtifact({
      goalId: goal.id,
      title: 'Agent桌面原型',
      description: '具有状态机、检查点、风险审批和日志追踪的可运行Electron原型，用来验证长程Agent工程能力。',
      content: '主进程、渲染进程、IPC、状态迁移、测试与README。'.repeat(10),
      provenance: { repository: 'local', author: 'learner' }
    });
    expect(learning.evaluateArtifact(artifact.id).passed).toBe(true);
    expect(learning.dashboard().metrics.resourceCount).toBeGreaterThan(0);
    database.close();
  });
});
