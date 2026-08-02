import { app, dialog, ipcMain } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  AppearancePreferencesSchema,
  ArchiveArtifactInputSchema, CreateHabitInputSchema, HabitCheckInInputSchema,
  ArchiveAssessmentInputSchema,
  ArchiveGoalInputSchema,
  ArchiveResourceInputSchema,
  CompleteMilestoneInputSchema,
  CompleteSessionInputSchema,
  EvaluateArtifactInputSchema,
  IPC,
  PinConversationInputSchema,
  RenameGoalInputSchema,
  SaveConversationDraftInputSchema,
  TouchConversationInputSchema,
  ProviderInputSchema,
  ProviderToggleInputSchema,
  ResolveApprovalInputSchema,
  RestoreBackupInputSchema,
  ReviewRecordInputSchema,
  SearchLibraryInputSchema,
  SubmitAssessmentInputSchema,
  SuspendReviewInputSchema,
  UpdateGoalInputSchema,
  UpdateHabitInputSchema,
  UpdateMisconceptionInputSchema,
  UpdateTaskInputSchema,
  SendMessageInputSchema,
  UpsertLearningContractInputSchema,
  GenerateWeeklyReviewInputSchema
} from '../../shared/contracts';
import type { LearningResource } from '../../shared/domain';
import type { LearningService } from '../services/learning-service';
import type { ProviderService } from '../services/provider-service';
import type { RunManager } from '../agents/run-manager';

export function registerIpc(input: { learning: LearningService; providers: ProviderService; runs: RunManager }): void {
  const { learning, providers, runs } = input;

  ipcMain.handle(IPC.DASHBOARD_GET, () => learning.dashboard());
  ipcMain.handle(IPC.APPEARANCE_SAVE, (_event, raw) => learning.saveAppearancePreferences(AppearancePreferencesSchema.parse(raw)));
  ipcMain.handle(IPC.AGENT_SEND, (_event, raw) => runs.start(SendMessageInputSchema.parse(raw)));
  ipcMain.handle(IPC.AGENT_PAUSE, (_event, runId: string) => runs.pause(runId));
  ipcMain.handle(IPC.AGENT_RESUME, (_event, runId: string) => runs.resume(runId));
  ipcMain.handle(IPC.AGENT_CANCEL, (_event, runId: string) => runs.cancel(runId));
  ipcMain.handle(IPC.APPROVAL_RESOLVE, (_event, raw) => runs.resolveApproval(ResolveApprovalInputSchema.parse(raw)));
  ipcMain.handle(IPC.LEARNING_REVIEW_RECORD, (_event, raw) => {
    const review = ReviewRecordInputSchema.parse(raw);
    learning.recordReview(review.itemId, review.rating);
  });
  ipcMain.handle(IPC.LEARNING_TASK_COMPLETE, (_event, taskId: string) => learning.completeTask(taskId));
  ipcMain.handle(IPC.LEARNING_SESSION_COMPLETE, (_event, raw) => {
    const session = CompleteSessionInputSchema.parse(raw);
    learning.completeActiveSession(session.workspaceId, session.summary);
  });
  ipcMain.handle(IPC.LEARNING_MILESTONE_COMPLETE, (_event, raw) => {
    const input = CompleteMilestoneInputSchema.parse(raw);
    return learning.completeMilestone(input.milestoneId);
  });
  ipcMain.handle(IPC.LEARNING_ASSESSMENT_SUBMIT, (_event, raw) => {
    const input = SubmitAssessmentInputSchema.parse(raw);
    return learning.submitAssessment(input.assessmentId, input.answer);
  });
  ipcMain.handle(IPC.LEARNING_ARTIFACT_EVALUATE, (_event, raw) => {
    const input = EvaluateArtifactInputSchema.parse(raw);
    return learning.evaluateArtifact(input.artifactId);
  });
  ipcMain.handle(IPC.LEARNING_GOAL_UPDATE, (_event, raw) => learning.updateGoal(UpdateGoalInputSchema.parse(raw)));
  ipcMain.handle(IPC.LEARNING_TASK_UPDATE, (_event, raw) => learning.updateTask(UpdateTaskInputSchema.parse(raw)));
  ipcMain.handle(IPC.LEARNING_MISCONCEPTION_UPDATE, (_event, raw) => {
    const input = UpdateMisconceptionInputSchema.parse(raw);
    return learning.updateMisconception(input.misconceptionId, input.status);
  });
  ipcMain.handle(IPC.LEARNING_REVIEW_SUSPEND, (_event, raw) => {
    const input = SuspendReviewInputSchema.parse(raw);
    return learning.suspendReview(input.itemId, input.suspended);
  });
  ipcMain.handle(IPC.LEARNING_RESOURCE_ARCHIVE, (_event, raw) => {
    const input = ArchiveResourceInputSchema.parse(raw);
    return learning.archiveResource(input.resourceId, input.archived);
  });
  ipcMain.handle(IPC.LEARNING_ASSESSMENT_ARCHIVE, (_event, raw) => {
    const input = ArchiveAssessmentInputSchema.parse(raw);
    learning.archiveAssessment(input.assessmentId, input.archived);
  });
  ipcMain.handle(IPC.LEARNING_ARTIFACT_ARCHIVE, (_event, raw) => {
    const input = ArchiveArtifactInputSchema.parse(raw);
    learning.archiveArtifact(input.artifactId, input.archived);
  });
  ipcMain.handle(IPC.LEARNING_GOAL_CREATE, (_event, raw: { title: string }) => {
    const workspaceId = learning.dashboard().workspace.id;
    return learning.createGoal({ workspaceId, title: raw.title, description: '', desiredOutcome: '' });
  });
  ipcMain.handle(IPC.LEARNING_HABIT_CREATE, (_event, raw) => learning.createHabit(CreateHabitInputSchema.parse(raw)));
  ipcMain.handle(IPC.LEARNING_HABIT_UPDATE, (_event, raw) => learning.updateHabit(UpdateHabitInputSchema.parse(raw)));
  ipcMain.handle(IPC.LEARNING_HABIT_CHECKIN, (_event, raw) => learning.checkInHabit(HabitCheckInInputSchema.parse(raw)));
  ipcMain.handle(IPC.LEARNING_CONTRACT_UPSERT, (_event, raw) => learning.upsertLearningContract(UpsertLearningContractInputSchema.parse(raw)));
  ipcMain.handle(IPC.LEARNING_WEEKLY_REVIEW, (_event, raw) => { const input = GenerateWeeklyReviewInputSchema.parse(raw); return learning.generateWeeklyReview(input.goalId, input.reflection); });
  ipcMain.handle(IPC.CONVERSATION_RENAME_GOAL, (_event, raw) => {
    const input = RenameGoalInputSchema.parse(raw);
    learning.renameGoal(input.goalId, input.title);
  });
  ipcMain.handle(IPC.CONVERSATION_ARCHIVE_GOAL, (_event, raw) => {
    const input = ArchiveGoalInputSchema.parse(raw);
    learning.archiveGoal(input.goalId, input.archived);
  });
  ipcMain.handle(IPC.CONVERSATION_PIN, (_event, raw) => {
    const input = PinConversationInputSchema.parse(raw);
    learning.pinConversation(input.conversationId, input.pinned);
  });
  ipcMain.handle(IPC.CONVERSATION_SAVE_DRAFT, (_event, raw) => {
    const input = SaveConversationDraftInputSchema.parse(raw);
    learning.saveConversationDraft(input.conversationId, input.draft);
  });
  ipcMain.handle(IPC.CONVERSATION_TOUCH, (_event, raw) => {
    const input = TouchConversationInputSchema.parse(raw);
    learning.touchConversation(input.conversationId);
  });
  ipcMain.handle(IPC.LIBRARY_SEARCH, (_event, raw) => {
    const input = SearchLibraryInputSchema.parse(raw);
    const workspace = learning.getDefaultWorkspace();
    return learning.searchResources(workspace.id, input.query, input.goalId, input.limit);
  });
  ipcMain.handle(IPC.LIBRARY_IMPORT_FILES, async (_event, raw: { goalId?: string } | undefined) => {
    const result = await dialog.showOpenDialog({
      title: '导入个人学习资料',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: '文本资料', extensions: ['txt', 'md', 'markdown', 'json', 'csv'] }]
    });
    if (result.canceled) return { cancelled: true, imported: [] };
    const workspace = learning.getDefaultWorkspace();
    const imported: LearningResource[] = [];
    for (const filePath of result.filePaths.slice(0, 20)) {
      const extension = path.extname(filePath).toLowerCase();
      if (!['.txt', '.md', '.markdown', '.json', '.csv'].includes(extension)) continue;
      const stat = await fs.stat(filePath);
      if (stat.size > 5 * 1024 * 1024) throw new Error(`文件过大：${path.basename(filePath)}。单文件最大5MB。`);
      const content = await fs.readFile(filePath, 'utf8');
      const kind = extension === '.md' || extension === '.markdown' ? 'markdown' : extension === '.json' ? 'json' : extension === '.csv' ? 'csv' : 'text';
      imported.push(learning.importResource({
        workspaceId: workspace.id, goalId: raw?.goalId, title: path.basename(filePath), kind, content, sourcePath: filePath,
        mimeType: kind === 'json' ? 'application/json' : kind === 'csv' ? 'text/csv' : 'text/plain', tags: ['本地导入']
      }));
    }
    return { cancelled: false, imported };
  });
  ipcMain.handle(IPC.PROVIDER_LIST, () => providers.list());
  ipcMain.handle(IPC.PROVIDER_SAVE, (_event, raw) => providers.save(ProviderInputSchema.parse(raw)));
  ipcMain.handle(IPC.PROVIDER_REMOVE, (_event, id: string) => providers.remove(id));
  ipcMain.handle(IPC.PROVIDER_TEST, (_event, id: string) => providers.test(id));
  ipcMain.handle(IPC.PROVIDER_SET_DEFAULT, (_event, id: string) => providers.setDefault(id));
  ipcMain.handle(IPC.PROVIDER_TOGGLE, (_event, raw) => {
    const provider = ProviderToggleInputSchema.parse(raw);
    return providers.toggle(provider.id, provider.enabled);
  });
  ipcMain.handle(IPC.MAINTENANCE_SNAPSHOT, () => learning.maintenanceSnapshot());
  ipcMain.handle(IPC.MAINTENANCE_BACKUP_CREATE, () => learning.createManualBackup());
  ipcMain.handle(IPC.MAINTENANCE_BACKUP_RESTORE, (_event, raw) => {
    const { name } = RestoreBackupInputSchema.parse(raw);
    learning.stageBackupRestore(name);
    setTimeout(() => { app.relaunch(); app.exit(0); }, 120);
  });
  ipcMain.handle(IPC.WORKSPACE_EXPORT, async (_event, payload: { format?: string; goalName?: string; goalId?: string }) => {
    const fmt = (payload?.format === 'markdown' || payload?.format === 'html' || payload?.format === 'text') ? payload.format : 'json';
    const filters: Record<string, Array<{ name: string; extensions: string[] }>> = {
      json: [{ name: 'JSON', extensions: ['json'] }],
      markdown: [{ name: 'Markdown', extensions: ['md'] }],
      html: [{ name: 'HTML', extensions: ['html', 'htm'] }],
      text: [{ name: '纯文本', extensions: ['txt'] }]
    };
    const extensions: Record<string, string> = { json: 'json', markdown: 'md', html: 'html', text: 'txt' };

    const dashboard = learning.dashboard();
    const goalId = payload?.goalId;
    const goalPart = (payload?.goalName || dashboard.workspace.name).replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, '-').slice(0, 60);
    const now = new Date();
    const ts = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

    const result = await dialog.showSaveDialog({
      title: goalId ? `导出「${payload?.goalName || '目标'}」` : '导出 Self-Study.ai 学习资产',
      defaultPath: `${goalPart}-${ts}.${extensions[fmt]}`,
      filters: filters[fmt]
    });
    if (result.canceled || !result.filePath) return { cancelled: true };

    const allMessages = learning.listAllMessages(dashboard.workspace.id);
    const byGoal = <T extends { goalId?: string | null }>(items: T[]) => items.filter((i) => i.goalId === goalId);
    const snapshot = goalId
      ? ({
          ...dashboard,
          messages: allMessages.filter((m) => m.goalId === goalId),
          goals: dashboard.goals.filter((g) => g.id === goalId),
          conversations: dashboard.conversations.filter((c) => c.goalId === goalId),
          tasks: byGoal(dashboard.tasks),
          knowledgeNodes: byGoal(dashboard.knowledgeNodes),
          knowledgeEdges: byGoal(dashboard.knowledgeEdges),
          misconceptions: byGoal(dashboard.misconceptions),
          reviewItems: byGoal(dashboard.reviewItems),
          habits: byGoal(dashboard.habits),
          habitCheckIns: byGoal(dashboard.habitCheckIns),
          contracts: byGoal(dashboard.contracts),
          weeklyReviews: byGoal(dashboard.weeklyReviews),
          sessions: byGoal(dashboard.sessions),
          artifacts: byGoal(dashboard.artifacts),
          artifactEvaluations: byGoal(dashboard.artifactEvaluations),
          paths: byGoal(dashboard.paths),
          milestones: byGoal(dashboard.milestones),
          resources: dashboard.resources.filter((r) => !r.goalId || r.goalId === goalId),
          assessments: byGoal(dashboard.assessments),
          assessmentAttempts: byGoal(dashboard.assessmentAttempts),
          evidence: byGoal(dashboard.evidence),
          activeRuns: dashboard.activeRuns.filter((r) => r.goalId === goalId),
          approvals: dashboard.approvals.filter((a) => dashboard.activeRuns.find((r) => r.id === a.runId)?.goalId === goalId),
          oneToOneStates: goalId in dashboard.oneToOneStates ? { [goalId]: dashboard.oneToOneStates[goalId] } : {} as typeof dashboard.oneToOneStates,
          behaviorStates: goalId in dashboard.behaviorStates ? { [goalId]: dashboard.behaviorStates[goalId] } : {} as typeof dashboard.behaviorStates
        } as typeof dashboard)
      : { ...dashboard, messages: allMessages };
    await fs.mkdir(path.dirname(result.filePath), { recursive: true });

    switch (fmt) {
      case 'json':
        await fs.writeFile(result.filePath, JSON.stringify(snapshot, null, 2), 'utf8');
        break;
      case 'markdown':
        await fs.writeFile(result.filePath, renderMarkdown(snapshot), 'utf8');
        break;
      case 'html':
        await fs.writeFile(result.filePath, renderHtml(snapshot), 'utf8');
        break;
      case 'text':
        await fs.writeFile(result.filePath, renderText(snapshot), 'utf8');
        break;
    }
    return { cancelled: false, path: result.filePath };
  });
}

function renderMarkdown(snapshot: ReturnType<LearningService['dashboard']>): string {
  const goals = snapshot.goals.map((goal) => `## ${goal.title}

${goal.description}

- 当前层级：L${goal.currentLevel}
- 目标层级：L${goal.targetLevel}
- 期望成果：${goal.desiredOutcome}
`).join('\n');
  const paths = snapshot.paths.map((item) => {
    const milestones = snapshot.milestones.filter((milestone) => milestone.pathId === item.id)
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((milestone) => `  - [${milestone.status === 'completed' ? 'x' : ' '}] ${milestone.title}：${milestone.outcome}`)
      .join('\n');
    return `## ${item.title}（${item.status}/v${item.version}）\n\n${item.description}\n\n${milestones}`;
  }).join('\n\n');
  const evidence = snapshot.evidence.map((item) => `- **${item.title}**：独立性 ${Math.round(item.independence * 100)}%，保持 ${Math.round(item.retention * 100)}%，迁移 ${Math.round(item.transfer * 100)}%`).join('\n');
  const knowledge = snapshot.knowledgeNodes.map((node) => `- **${node.title}**：掌握 ${Math.round(node.mastery * 100)}%，置信 ${Math.round(node.confidence * 100)}%`).join('\n');
  const resources = snapshot.resources.map((resource) => `- **${resource.title}**（${resource.kind}，${resource.chunkCount}片段）：${resource.summary}`).join('\n');
  const assessments = snapshot.assessments.map((assessment) => {
    const attempts = snapshot.assessmentAttempts.filter((attempt) => attempt.assessmentId === assessment.id);
    const latest = attempts[0];
    return `- **${assessment.title}**（${assessment.status}）${latest ? `：最近得分 ${Math.round(latest.score * 100)}%` : ''}`;
  }).join('\n');
  const artifacts = snapshot.artifacts.map((artifact) => {
    const evaluation = snapshot.artifactEvaluations.find((item) => item.artifactId === artifact.id);
    return `- **${artifact.title}**（${artifact.kind}/${artifact.status}）${evaluation ? `：验收 ${Math.round(evaluation.score * 100)}%` : ''}：${artifact.description}`;
  }).join('\n');
  const reviews = snapshot.reviewItems.filter((item) => !item.suspended).map((item) => `- ${item.prompt}（下次：${item.dueAt}）`).join('\n');
  const contracts = snapshot.goals.map((goal) => {
    const contract = snapshot.contracts.find((item) => item.goalId === goal.id);
    if (!contract) return `## ${goal.title}

尚未建立正式一对一学习契约。`;
    const state = snapshot.oneToOneStates[goal.id];
    const reviews = snapshot.weeklyReviews.filter((item) => item.goalId === goal.id).slice(0, 8)
      .map((review) => `### ${review.periodStart}—${review.periodEnd}

- 会话：${review.completedSessions}/${review.plannedSessions}
- 微行动：${review.tinyActionsCompleted}
- 新证据：${review.evidenceCreated}
- 教练总结：${review.coachSummary}
- 下周重点：${review.nextFocus}
- 行为调整：${review.behaviorAdjustment}`)
      .join('\n\n');
    return `## ${goal.title}

- 学习者：${contract.learnerName}
- 为什么现在：${contract.whyNow}
- 成功定义：${contract.successDefinition}
- 每周预算：${contract.weeklyMinutes}分钟
- 单次会话：${contract.sessionMinutes}分钟
- 教练方式：${contract.coachingStyle}
- 反馈方式：${contract.feedbackPreference}
- 自主性目标：${Math.round(contract.autonomyTarget * 100)}%
- 最低承诺：${contract.minimumCommitment}
- 当前状态：${state?.coachingSummary ?? '待评估'}

${reviews || '暂无周复盘。'}`;
  }).join('\n\n---\n\n');

  const habits = snapshot.goals.map((goal) => {
    const goalHabits = snapshot.habits.filter((habit) => habit.goalId === goal.id);
    if (!goalHabits.length) return `## ${goal.title}\n\n暂无微习惯。`;
    const state = snapshot.behaviorStates[goal.id];
    const recipes = goalHabits.map((habit) => {
      const entries = snapshot.habitCheckIns.filter((item) => item.habitId === habit.id);
      const completed = entries.filter((item) => item.result === 'done').length;
      return `### ${habit.title}（${habit.status}）\n\n- 当：${habit.anchor}\n- 我就：${habit.tinyBehavior}\n- 然后：${habit.celebration}\n- 可选扩展：${habit.expansionBehavior || '无'}\n- 最小：${habit.minimumSeconds}秒；理想：${habit.preferredMinutes}分钟\n- 完成记录：${completed}/${entries.length}；当前连续：${habit.streak}；最佳：${habit.bestStreak}`;
    }).join('\n\n');
    return `## ${goal.title}\n\n${state ? `行为状态：动机${Math.round(state.motivation * 100)}%，能力${Math.round(state.ability * 100)}%，提示可靠性${Math.round(state.promptReliability * 100)}%，成功率${Math.round(state.successRate * 100)}%。\n\n当前最小行动：${state.suggestedTinyAction}\n\n` : ''}${recipes}`;
  }).join('\n\n---\n\n');
  const conversations = snapshot.goals.map((goal) => {
    const messages = snapshot.messages.filter((message) => message.goalId === goal.id);
    if (!messages.length) return `## ${goal.title}\n\n暂无会话记录。`;
    const transcript = messages.map((message) => {
      const author = message.role === 'user' ? '学习者' : message.role === 'assistant' ? 'Self-Study' : '系统';
      return `### ${author} · ${message.createdAt}\n\n${message.content}`;
    }).join('\n\n');
    return `## ${goal.title}\n\n${transcript}`;
  }).join('\n\n---\n\n');
  return `# ${snapshot.workspace.name}

${snapshot.workspace.description}

# 今日建议

${snapshot.dailyBrief.nextAction}

# 学习目标

${goals || '暂无'}

# 一条龙学习路径

${paths || '暂无'}

# 知识地图

${knowledge || '暂无'}

# 个人资料库

${resources || '暂无'}

# 独立掌握评估

${assessments || '暂无'}

# 能力证据

${evidence || '暂无'}

# 作品与验收

${artifacts || '暂无'}

# 复习队列

${reviews || '暂无'}

# 正式一对一学习契约与周复盘

${contracts || '暂无'}

# 一对一行为设计与微习惯

${habits || '暂无'}

# 独立目标会话记录

${conversations || '暂无'}
`;
}

function renderHtml(snapshot: ReturnType<LearningService['dashboard']>): string {
  const md = renderMarkdown(snapshot);
  const html = markdownToHtml(md);
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${snapshot.workspace.name} - Self-Study.ai</title>
<style>
  :root {
    --bg: #fafafa; --text: #1a1a1a; --muted: #666; --border: #e5e5e5;
    --accent: #07b85a; --code-bg: #f0f0f0; --radius: 8px;
  }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #1a1a1a; --text: #e5e5e5; --muted: #999; --border: #333; --code-bg: #2a2a2a; }
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { max-width: 760px; margin: 40px auto; padding: 0 24px 60px; font-family: -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif; color: var(--text); background: var(--bg); line-height: 1.78; font-size: 15px; }
  h1 { font-size: 24px; font-weight: 700; margin: 32px 0 12px; padding-bottom: 10px; border-bottom: 2px solid var(--border); letter-spacing: -.02em; }
  h2 { font-size: 19px; font-weight: 650; margin: 28px 0 10px; color: var(--text); }
  h3 { font-size: 15px; font-weight: 600; margin: 20px 0 8px; color: var(--muted); }
  p { margin: 0 0 14px; }
  ul, ol { margin: 0 0 14px; padding-left: 22px; }
  li { margin-bottom: 4px; }
  strong { font-weight: 650; color: var(--text); }
  hr { border: 0; border-top: 1px solid var(--border); margin: 28px 0; }
  pre { background: var(--code-bg); padding: 14px 16px; border-radius: var(--radius); overflow-x: auto; font-size: 13px; line-height: 1.6; margin: 0 0 14px; }
  code { font-family: "SF Mono",Monaco,"Cascadia Code",monospace; font-size: .9em; }
  blockquote { border-left: 3px solid var(--accent); margin: 0 0 14px; padding: 8px 16px; color: var(--muted); background: color-mix(in srgb, var(--accent) 6%, var(--bg)); border-radius: 0 var(--radius) var(--radius) 0; }
  .check-done { color: var(--accent); font-weight: 700; }
  .check-pending { color: var(--muted); }
  @media print { body { max-width: 100%; font-size: 13px; } }
</style>
</head>
<body>
${html}
</body>
</html>`;
}

function markdownToHtml(md: string): string {
  const lines = md.split('\n');
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // Headings
    if (/^### /.test(line)) { out.push(`<h3>${escapeHtml(line.slice(4))}</h3>`); i++; continue; }
    if (/^## /.test(line)) { out.push(`<h2>${escapeHtml(line.slice(3))}</h2>`); i++; continue; }
    if (/^# /.test(line)) { out.push(`<h1>${escapeHtml(line.slice(2))}</h1>`); i++; continue; }
    // Horizontal rule
    if (/^---\s*$/.test(line)) { out.push('<hr>'); i++; continue; }
    // Empty line
    if (/^\s*$/.test(line)) { i++; continue; }
    // Unordered list
    if (/^- /.test(line) || /^  - /.test(line)) {
      out.push('<ul>');
      while (i < lines.length && (/^- /.test(lines[i]) || /^  - /.test(lines[i]))) {
        const item = lines[i].replace(/^  - /, '').replace(/^- /, '');
        out.push(`<li>${inlineMarkdown(item)}</li>`);
        i++;
      }
      out.push('</ul>');
      continue;
    }
    // Checkbox
    if (/^  - \[(x| )\]/.test(line) || /^- \[(x| )\]/.test(line)) {
      out.push('<ul style="list-style:none;padding-left:4px">');
      while (i < lines.length && (/^- \[(x| )\]/.test(lines[i]) || /^  - \[(x| )\]/.test(lines[i]))) {
        const m = lines[i].match(/\[(x| )\]/);
        const checked = m && m[1] === 'x';
        const item = lines[i].replace(/^  - \[[x ]\]\s*/, '').replace(/^- \[[x ]\]\s*/, '');
        out.push(`<li><span class="${checked ? 'check-done' : 'check-pending'}">${checked ? '☑' : '☐'}</span> ${inlineMarkdown(item)}</li>`);
        i++;
      }
      out.push('</ul>');
      continue;
    }
    // Paragraph
    let para = '';
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^#/.test(lines[i]) && !/^-/.test(lines[i]) && !/^---/.test(lines[i])) {
      para += (para ? ' ' : '') + lines[i];
      i++;
    }
    if (para.trim()) out.push(`<p>${inlineMarkdown(para)}</p>`);
  }
  return out.join('\n');
}

function inlineMarkdown(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderText(snapshot: ReturnType<LearningService['dashboard']>): string {
  return renderMarkdown(snapshot)
    .replace(/^#+\s*/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/\[([x ])\]/g, '[$1]')
    .replace(/^- /gm, '· ')
    .replace(/^ {2}- /gm, '  · ')
    .replace(/\n{3,}/g, '\n\n');
}

