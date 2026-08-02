import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../store';
import type { GoalStatus, HabitFrequency, ResourceSearchHit, ReviewRating, TaskStatus } from '../../shared/domain';

const tabs = [
  ['contract', '契约'],
  ['path', '目标'],
  ['tasks', '任务'],
  ['habits', '微习惯'],
  ['focus', '专注'],
  ['review', '复习'],
  ['knowledge', '知识'],
  ['library', '资料'],
  ['assessments', '评估'],
  ['artifacts', '作品'],
  ['evidence', '证据'],
  ['runs', '运行']
] as const;

export function Inspector() {
  const dashboard = useAppStore((state) => state.dashboard);
  const selectedGoalId = useAppStore((state) => state.selectedGoalId);
  const tab = useAppStore((state) => state.inspectorTab);
  const setTab = useAppStore((state) => state.setInspectorTab);
  const setInspectorOpen = useAppStore((state) => state.setInspectorOpen);
  const resolveApproval = useAppStore((state) => state.resolveApproval);
  const recordReview = useAppStore((state) => state.recordReview);
  const completeTask = useAppStore((state) => state.completeTask);
  const completeMilestone = useAppStore((state) => state.completeMilestone);
  const submitAssessment = useAppStore((state) => state.submitAssessment);
  const evaluateArtifact = useAppStore((state) => state.evaluateArtifact);
  const importResources = useAppStore((state) => state.importResources);
  const searchLibrary = useAppStore((state) => state.searchLibrary);
  const updateGoal = useAppStore((state) => state.updateGoal);
  const updateTask = useAppStore((state) => state.updateTask);
  const updateMisconception = useAppStore((state) => state.updateMisconception);
  const suspendReview = useAppStore((state) => state.suspendReview);
  const archiveResource = useAppStore((state) => state.archiveResource);
  const archiveAssessment = useAppStore((state) => state.archiveAssessment);
  const archiveArtifact = useAppStore((state) => state.archiveArtifact);
  const createHabit = useAppStore((state) => state.createHabit);
  const updateHabit = useAppStore((state) => state.updateHabit);
  const checkInHabit = useAppStore((state) => state.checkInHabit);
  const upsertContract = useAppStore((state) => state.upsertContract);
  const generateWeeklyReview = useAppStore((state) => state.generateWeeklyReview);
  const createBackup = useAppStore((state) => state.createBackup);
  const restoreBackup = useAppStore((state) => state.restoreBackup);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [libraryQuery, setLibraryQuery] = useState('');
  const [libraryHits, setLibraryHits] = useState<ResourceSearchHit[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [goalEditing, setGoalEditing] = useState(false);
  const [habitCreating, setHabitCreating] = useState(false);
  const [habitEditingId, setHabitEditingId] = useState<string>();
  const [habitConditions, setHabitConditions] = useState<Record<string, { motivation: number; ability: number; promptSeen: boolean }>>({});
  const [contractEditing, setContractEditing] = useState(false);
  const [weeklyReflection, setWeeklyReflection] = useState('');
  const [contractForm, setContractForm] = useState({ learnerName: '学习者', whyNow: '', successDefinition: '', weeklyMinutes: 180, sessionMinutes: 25, preferredDays: [1,2,3,4,5] as number[], preferredTime: '', coachingStyle: 'balanced' as 'socratic' | 'direct' | 'balanced' | 'project', feedbackPreference: 'evidence-first' as 'gentle' | 'direct' | 'evidence-first', challengeLevel: 3, autonomyTarget: 0.8, minimumCommitment: '完成一次30秒最小学习行动', reviewCadence: 'weekly' as 'weekly' | 'biweekly' | 'monthly', status: 'active' as 'draft' | 'active' | 'paused' | 'completed' });
  const [habitForm, setHabitForm] = useState({ title: '', anchor: '我打开当前学习目标后', tinyBehavior: '', expansionBehavior: '', celebration: '轻轻点头，对自己说"我已经开始了"', frequency: 'daily' as HabitFrequency, customDays: [] as number[], minimumSeconds: 30, preferredMinutes: 10 });
  const selectedGoal = dashboard?.goals.find((goal) => goal.id === selectedGoalId);
  const [goalForm, setGoalForm] = useState({ title: '', description: '', desiredOutcome: '', currentLevel: 1, targetLevel: 4, status: 'active' as GoalStatus, targetDate: '' });

  useEffect(() => {
    if (!selectedGoal) return;
    setGoalForm({
      title: selectedGoal.title,
      description: selectedGoal.description,
      desiredOutcome: selectedGoal.desiredOutcome,
      currentLevel: selectedGoal.currentLevel,
      targetLevel: selectedGoal.targetLevel,
      status: selectedGoal.status,
      targetDate: selectedGoal.targetDate?.slice(0, 10) ?? ''
    });
    setGoalEditing(false);
  }, [selectedGoal]);

  useEffect(() => {
    if (!dashboard || !selectedGoalId) return;
    const contract = dashboard.contracts.find((item) => item.goalId === selectedGoalId);
    setContractForm(contract ? {
      learnerName: contract.learnerName, whyNow: contract.whyNow, successDefinition: contract.successDefinition,
      weeklyMinutes: contract.weeklyMinutes, sessionMinutes: contract.sessionMinutes, preferredDays: contract.preferredDays,
      preferredTime: contract.preferredTime, coachingStyle: contract.coachingStyle, feedbackPreference: contract.feedbackPreference,
      challengeLevel: contract.challengeLevel, autonomyTarget: contract.autonomyTarget, minimumCommitment: contract.minimumCommitment,
      reviewCadence: contract.reviewCadence, status: contract.status
    } : { learnerName: '学习者', whyNow: selectedGoal?.description || `现在开始推进"${selectedGoal?.title ?? '当前目标'}"`, successDefinition: selectedGoal?.desiredOutcome || '', weeklyMinutes: 180, sessionMinutes: 25, preferredDays: [1,2,3,4,5], preferredTime: '', coachingStyle: 'balanced', feedbackPreference: 'evidence-first', challengeLevel: 3, autonomyTarget: 0.8, minimumCommitment: '完成一次30秒最小学习行动', reviewCadence: 'weekly', status: 'active' });
    setContractEditing(!contract);
  }, [dashboard, selectedGoal, selectedGoalId]);

  if (!dashboard) return <aside className="inspector skeleton" />;
  const filterGoal = <T extends { goalId: string }>(items: T[]) => selectedGoalId ? items.filter((item) => item.goalId === selectedGoalId) : [];
  const allTasks = filterGoal(dashboard.tasks);
  const tasks = allTasks.filter((item) => showArchived || !item.archived);
  const evidence = filterGoal(dashboard.evidence);
  const habits = filterGoal(dashboard.habits).filter((item) => showArchived || item.status !== 'retired');
  const habitCheckIns = filterGoal(dashboard.habitCheckIns);
  const behaviorState = selectedGoalId ? dashboard.behaviorStates[selectedGoalId] ?? dashboard.behaviorState : dashboard.behaviorState;
  const contract = selectedGoalId ? dashboard.contracts.find((item) => item.goalId === selectedGoalId) : undefined;
  const weeklyReviews = selectedGoalId ? dashboard.weeklyReviews.filter((item) => item.goalId === selectedGoalId) : [];
  const oneToOneState = selectedGoalId ? dashboard.oneToOneStates[selectedGoalId] : undefined;
  const allReviews = filterGoal(dashboard.reviewItems);
  const reviews = allReviews.filter((item) => showArchived || !item.suspended);
  const nodes = filterGoal(dashboard.knowledgeNodes);
  const misconceptions = filterGoal(dashboard.misconceptions);
  const allArtifacts = filterGoal(dashboard.artifacts);
  const artifacts = allArtifacts.filter((item) => showArchived || item.status !== 'archived');
  const paths = filterGoal(dashboard.paths);
  const activePath = paths.find((path) => path.status === 'active') ?? paths[0];
  const milestones = activePath ? dashboard.milestones.filter((milestone) => milestone.pathId === activePath.id) : [];
  const allResources = dashboard.resources.filter((resource) => !selectedGoalId || !resource.goalId || resource.goalId === selectedGoalId);
  const resources = allResources.filter((item) => showArchived || !item.archived);
  const allAssessments = filterGoal(dashboard.assessments);
  const assessments = allAssessments.filter((item) => showArchived || item.status !== 'archived');
  const attempts = filterGoal(dashboard.assessmentAttempts);
  const scopedSessions = selectedGoalId ? dashboard.sessions.filter((item) => item.goalId === selectedGoalId) : [];
  const scopedRuns = selectedGoalId ? dashboard.activeRuns.filter((item) => item.goalId === selectedGoalId) : [];
  const scopedApprovals = dashboard.approvals.filter((approval) => {
    const run = dashboard.activeRuns.find((item) => item.id === approval.runId);
    return selectedGoalId ? run?.goalId === selectedGoalId : !run?.goalId;
  });
  const attention = useMemo(() => ({
    contract: !contract || (oneToOneState?.nextReviewDue && new Date(oneToOneState.nextReviewDue) <= new Date()) ? 1 : 0,
    tasks: allTasks.filter((item) => ['todo', 'doing', 'blocked'].includes(item.status)).length,
    habits: habits.filter((item) => item.status === 'active' && !habitCheckIns.some((entry) => entry.habitId === item.id && entry.localDate === localDateKey(new Date()) && entry.result === 'done')).length,
    focus: scopedSessions.filter((s) => s.status === 'active').length,
    review: allReviews.filter((item) => !item.suspended && new Date(item.dueAt) <= new Date()).length,
    knowledge: misconceptions.filter((item) => item.status !== 'resolved').length,
    assessments: allAssessments.filter((item) => item.status === 'ready').length,
    runs: scopedRuns.length + scopedApprovals.length
  }), [allAssessments, contract, oneToOneState?.nextReviewDue, allReviews, allTasks, habits, habitCheckIns, misconceptions, scopedApprovals.length, scopedRuns.length, scopedSessions]);

  return (
    <aside className="inspector">
      <div className="inspector-head"><strong>学习详情</strong><button aria-label="关闭进度" onClick={() => setInspectorOpen(false)}>×</button></div>
      <div className="inspector-tabs scroll-tabs">
        {tabs.map(([id, label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}{attention[id as keyof typeof attention] ? <i>{attention[id as keyof typeof attention]}</i> : null}</button>)}
      </div>

      {scopedApprovals.length > 0 && (
        <section className="approval-section">
          <h3>需要你的批准</h3>
          {scopedApprovals.map((approval) => (
            <div className="approval-card" key={approval.id}>
              <span className={`risk ${approval.risk}`}>{approval.risk === 'high' ? '高风险' : '中风险'}</span>
              <p>{approval.reason}</p>
              <div><button onClick={() => void resolveApproval(approval.id, 'approved')}>批准</button><button className="secondary" onClick={() => void resolveApproval(approval.id, 'rejected')}>拒绝</button></div>
            </div>
          ))}
        </section>
      )}

      <div className="inspector-content">
        {tab === 'contract' && (
          <>
            <div className="contract-panel-head">
              <div>
                <h2>学习契约</h2>
                <span className="contract-panel-subtitle">你和 AI 之间的一对一自学约定</span>
              </div>
              {selectedGoal && contract && (
                <button className="contract-edit-toggle" onClick={() => setContractEditing((v) => !v)}>
                  {contractEditing ? '取消' : '编辑'}
                </button>
              )}
            </div>

            {/* ── No goal selected ── */}
            {!selectedGoal && (
              <div className="contract-empty">
                <div className="contract-empty-mark">S</div>
                <strong>选择和 AI 的自学约定</strong>
                <p>先选择一个学习目标，再建立属于这个目标的一对一学习契约。契约会告诉 AI 你的时间、偏好和成功标准。</p>
              </div>
            )}

            {/* ── Contract summary (view mode) · Zhang Xiaolong letter style ── */}
            {selectedGoal && !contractEditing && contract && (
              <section className="contract-letter">
                {/* Letterhead — personal, warm */}
                <div className="contract-letter-head">
                  <span className="contract-letter-avatar">{contract.learnerName[0]}</span>
                  <div className="contract-letter-byline">
                    <strong>{contract.learnerName}</strong>
                    <span>的自学契约</span>
                  </div>
                  <span className={`contract-letter-status ${contract.status}`}>
                    {contract.status === 'active' ? '生效中' : contract.status === 'paused' ? '已暂停' : contract.status === 'completed' ? '已完成' : '草稿'}
                  </span>
                </div>

                {/* The promise — why and what success means, as flowing prose */}
                <div className="contract-letter-body">
                  <p className="contract-letter-why">
                    <span className="contract-letter-label">为什么是现在</span>
                    {contract.whyNow}
                  </p>
                  <p className="contract-letter-success">
                    <span className="contract-letter-label">怎样才算成功</span>
                    {contract.successDefinition}
                  </p>
                </div>

                {/* Rhythm — key numbers in a quiet row, not a heavy grid */}
                <div className="contract-letter-rhythm">
                  <div className="contract-rhythm-item">
                    <span className="contract-rhythm-value">{contract.weeklyMinutes}<small>分钟/周</small></span>
                  </div>
                  <span className="contract-rhythm-sep">·</span>
                  <div className="contract-rhythm-item">
                    <span className="contract-rhythm-value">{contract.sessionMinutes}<small>分钟/次</small></span>
                  </div>
                  <span className="contract-rhythm-sep">·</span>
                  <div className="contract-rhythm-item">
                    <span className="contract-rhythm-value">{Math.round(contract.autonomyTarget * 100)}%<small>自主</small></span>
                  </div>
                  <span className="contract-rhythm-sep">·</span>
                  <div className="contract-rhythm-item">
                    <span className="contract-rhythm-value">{contract.reviewCadence === 'weekly' ? '每周' : contract.reviewCadence === 'biweekly' ? '每两周' : '每月'}<small>复盘</small></span>
                  </div>
                </div>

                {/* Style — quiet inline preferences */}
                <div className="contract-letter-style">
                  <span>{coachingStyleLabel(contract.coachingStyle)}</span>
                  <span>{feedbackLabel(contract.feedbackPreference)}</span>
                  <span>强度 {'●'.repeat(contract.challengeLevel)}{'○'.repeat(5 - contract.challengeLevel)}</span>
                  {contract.preferredDays.length > 0 && (
                    <span>{contract.preferredDays.map((d) => ['日','一','二','三','四','五','六'][d]).join('')} {contract.preferredTime || ''}</span>
                  )}
                </div>

                {/* Minimum commitment — quiet promise */}
                <p className="contract-letter-minimum">
                  <span>最低承诺</span>
                  {contract.minimumCommitment}
                </p>

                {/* Coach observation — warm, personal, like a WeChat voice message */}
                {oneToOneState && (
                  <div className="contract-coach-msg">
                    <div className="contract-coach-msg-head">
                      <span className="contract-coach-dot" />
                      <span>教练观察</span>
                      <time>{oneToOneState.nextReviewDue ? `下次复盘 ${oneToOneState.nextReviewDue}` : '待安排复盘'}</time>
                    </div>
                    <p className="contract-coach-msg-body">{oneToOneState.coachingSummary}</p>
                    <div className="contract-coach-msg-foot">
                      <span>当前自主性 {Math.round(oneToOneState.currentAutonomy * 100)}%</span>
                      <span>目标 {Math.round(contract.autonomyTarget * 100)}%</span>
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* ── Contract form (edit mode or no contract yet) · conversational ── */}
            {selectedGoal && (contractEditing || !contract) && (
              <form className="contract-edit-form" onSubmit={(event) => { event.preventDefault(); void upsertContract({ goalId: selectedGoal.id, ...contractForm, agree: true }).then(() => setContractEditing(false)); }}>
                <p className="contract-edit-intro">你和 AI 之间的自学约定。这会帮助教练理解你的节奏、偏好和成功的定义。</p>

                {/* Who you are */}
                <div className="contract-edit-group">
                  <span className="contract-edit-label">怎么称呼你</span>
                  <input value={contractForm.learnerName} onChange={(e) => setContractForm((c) => ({ ...c, learnerName: e.target.value }))} required placeholder="你的名字或昵称" />
                </div>

                {/* The heart — why and what success means */}
                <div className="contract-edit-group">
                  <span className="contract-edit-label">为什么是现在</span>
                  <p className="contract-edit-hint">不是"应该学"，而是为什么这个时机对你很重要。</p>
                  <textarea rows={2} value={contractForm.whyNow} onChange={(e) => setContractForm((c) => ({ ...c, whyNow: e.target.value }))} required placeholder="写下你此刻的真实动机…" />
                </div>

                <div className="contract-edit-group">
                  <span className="contract-edit-label">怎样才算真正成功</span>
                  <p className="contract-edit-hint">不是"学完"，而是你能独立做出什么、拿出什么证据。</p>
                  <textarea rows={2} value={contractForm.successDefinition} onChange={(e) => setContractForm((c) => ({ ...c, successDefinition: e.target.value }))} required placeholder="描绘你心中的成功画面…" />
                </div>

                {/* Rhythm */}
                <div className="contract-edit-group">
                  <span className="contract-edit-label">学习节奏</span>
                  <div className="contract-edit-row three">
                    <label>每周<small>分钟</small><input type="number" min={15} max={10080} value={contractForm.weeklyMinutes} onChange={(e) => setContractForm((c) => ({ ...c, weeklyMinutes: Number(e.target.value) }))} /></label>
                    <label>每次<small>分钟</small><input type="number" min={5} max={240} value={contractForm.sessionMinutes} onChange={(e) => setContractForm((c) => ({ ...c, sessionMinutes: Number(e.target.value) }))} /></label>
                    <label>挑战<small>强度</small><select value={contractForm.challengeLevel} onChange={(e) => setContractForm((c) => ({ ...c, challengeLevel: Number(e.target.value) }))}>{[1,2,3,4,5].map((v) => <option key={v} value={v}>{v} · {v <= 2 ? '轻松' : v === 3 ? '适中' : v === 4 ? '挑战' : '极限'}</option>)}</select></label>
                  </div>
                </div>

                <div className="contract-edit-group">
                  <span className="contract-edit-label">首选学习日与时间</span>
                  <div className="weekday-picker">
                    {['日','一','二','三','四','五','六'].map((label, day) => (
                      <button type="button" key={day} className={contractForm.preferredDays.includes(day) ? 'active' : ''} onClick={() => setContractForm((c) => ({ ...c, preferredDays: c.preferredDays.includes(day) ? c.preferredDays.filter((d) => d !== day) : [...c.preferredDays, day].sort() }))}>周{label}</button>
                    ))}
                  </div>
                  <input className="contract-edit-time" value={contractForm.preferredTime} onChange={(e) => setContractForm((c) => ({ ...c, preferredTime: e.target.value }))} placeholder="例如：工作日 20:30" />
                </div>

                {/* Coaching style */}
                <div className="contract-edit-group">
                  <span className="contract-edit-label">教练风格</span>
                  <div className="contract-edit-row three">
                    <label>方式<select value={contractForm.coachingStyle} onChange={(e) => setContractForm((c) => ({ ...c, coachingStyle: e.target.value as typeof contractForm.coachingStyle }))}><option value="balanced">平衡</option><option value="socratic">苏格拉底追问</option><option value="direct">直接指导</option><option value="project">项目驱动</option></select></label>
                    <label>反馈<select value={contractForm.feedbackPreference} onChange={(e) => setContractForm((c) => ({ ...c, feedbackPreference: e.target.value as typeof contractForm.feedbackPreference }))}><option value="evidence-first">证据优先</option><option value="gentle">温和</option><option value="direct">直接</option></select></label>
                    <label>复盘<select value={contractForm.reviewCadence} onChange={(e) => setContractForm((c) => ({ ...c, reviewCadence: e.target.value as typeof contractForm.reviewCadence }))}><option value="weekly">每周</option><option value="biweekly">每两周</option><option value="monthly">每月</option></select></label>
                  </div>
                </div>

                <div className="contract-edit-group">
                  <span className="contract-edit-label">自主性目标 <b>{Math.round(contractForm.autonomyTarget * 100)}%</b></span>
                  <p className="contract-edit-hint">你希望多大比例的学习由自己独立完成？AI 会在接近目标时逐步放手。</p>
                  <input type="range" min={0.2} max={1} step={0.05} value={contractForm.autonomyTarget} onChange={(e) => setContractForm((c) => ({ ...c, autonomyTarget: Number(e.target.value) }))} />
                </div>

                <div className="contract-edit-group">
                  <span className="contract-edit-label">最低承诺</span>
                  <p className="contract-edit-hint">低能量日也能完成的保底动作。小到几乎不需要意志力。</p>
                  <input value={contractForm.minimumCommitment} onChange={(e) => setContractForm((c) => ({ ...c, minimumCommitment: e.target.value }))} required placeholder="例如：打开项目看一眼，哪怕只读一行" />
                </div>

                <button type="submit" className="contract-edit-submit">确认并启用学习契约</button>
              </form>
            )}

            {/* ── Weekly review · integrated as ongoing conversation ── */}
            {selectedGoal && contract && (
              <section className="contract-reviews">
                <div className="contract-reviews-head">
                  <h3>周复盘</h3>
                  <span className="contract-reviews-count">{weeklyReviews.length} 次</span>
                </div>

                {/* Compose a reflection — quiet, low-pressure */}
                <div className="contract-review-compose">
                  <textarea
                    rows={2}
                    value={weeklyReflection}
                    onChange={(e) => setWeeklyReflection(e.target.value)}
                    placeholder="这周有什么真实的感受、变化或阻塞？想到什么就写什么…"
                  />
                  <button
                    className="contract-review-send"
                    onClick={() => void generateWeeklyReview({ goalId: selectedGoal.id, reflection: weeklyReflection }).then(() => setWeeklyReflection(''))}
                    disabled={!weeklyReflection.trim()}
                  >
                    生成复盘
                  </button>
                </div>

                {/* Past reviews — as a quiet timeline */}
                {weeklyReviews.slice(0, 6).map((review) => (
                  <div className="contract-review-item" key={review.id}>
                    <div className="contract-review-item-head">
                      <span className="contract-review-period">
                        {review.periodStart} — {review.periodEnd}
                      </span>
                      <span className="contract-review-stats">
                        {review.completedSessions}/{review.plannedSessions} 次会话 · {review.tinyActionsCompleted} 次微行动 · {review.evidenceCreated} 条证据
                      </span>
                    </div>
                    <p className="contract-review-summary">{review.coachSummary}</p>
                    <div className="contract-review-focus">
                      <span>下周重点</span>
                      <strong>{review.nextFocus}</strong>
                    </div>
                    {review.behaviorAdjustment && (
                      <p className="contract-review-adjustment">{review.behaviorAdjustment}</p>
                    )}
                  </div>
                ))}
              </section>
            )}
          </>
        )}

        {tab === 'path' && (
          <>
            <div className="panel-heading"><h2>目标与路径</h2>{selectedGoal && <button className="text-button" onClick={() => setGoalEditing((value) => !value)}>{goalEditing ? '取消' : '编辑目标'}</button>}</div>
            {!selectedGoal && <Empty text="从左侧选择一个目标，或新建长期学习目标。" />}
            {selectedGoal && goalEditing && (
              <form className="goal-detail-form" onSubmit={(event) => {
                event.preventDefault();
                void updateGoal({ ...goalForm, goalId: selectedGoal.id, targetDate: goalForm.targetDate ? new Date(`${goalForm.targetDate}T23:59:59`).toISOString() : '' }).then(() => setGoalEditing(false));
              }}>
                <label>目标名称<input value={goalForm.title} onChange={(event) => setGoalForm((current) => ({ ...current, title: event.target.value }))} required /></label>
                <label>学习背景<textarea value={goalForm.description} onChange={(event) => setGoalForm((current) => ({ ...current, description: event.target.value }))} rows={3} /></label>
                <label>可验证成果<textarea value={goalForm.desiredOutcome} onChange={(event) => setGoalForm((current) => ({ ...current, desiredOutcome: event.target.value }))} rows={3} /></label>
                <div className="form-grid three">
                  <label>当前层级<input type="number" min={1} max={9} value={goalForm.currentLevel} onChange={(event) => setGoalForm((current) => ({ ...current, currentLevel: Number(event.target.value) }))} /></label>
                  <label>目标层级<input type="number" min={1} max={9} value={goalForm.targetLevel} onChange={(event) => setGoalForm((current) => ({ ...current, targetLevel: Number(event.target.value) }))} /></label>
                  <label>状态<select value={goalForm.status} onChange={(event) => setGoalForm((current) => ({ ...current, status: event.target.value as GoalStatus }))}><option value="active">进行中</option><option value="paused">暂停</option><option value="completed">已完成</option><option value="archived">已归档</option></select></label>
                </div>
                <label>目标日期<input type="date" value={goalForm.targetDate} onChange={(event) => setGoalForm((current) => ({ ...current, targetDate: event.target.value }))} /></label>
                <button type="submit" disabled={!goalForm.title.trim()}>保存目标</button>
              </form>
            )}
            {selectedGoal && !goalEditing && <div className="goal-detail-summary"><strong>{selectedGoal.title}</strong><p>{selectedGoal.description || '尚未补充学习背景。'}</p><blockquote>{selectedGoal.desiredOutcome || '尚未定义可验证成果。'}</blockquote><small>L{selectedGoal.currentLevel} → L{selectedGoal.targetLevel} · {goalStatusLabel(selectedGoal.status)}{selectedGoal.targetDate ? ` · ${formatDate(selectedGoal.targetDate)}` : ''}</small></div>}
            {!activePath && selectedGoal && <Empty text="说「为这个目标编译一条龙学习路径」，系统会生成有证据门槛的阶段路线。" />}
            {activePath && <div className="path-summary"><strong>{activePath.title}</strong><p>{activePath.strategy}</p><small>版本 v{activePath.version} · 预计 {activePath.estimatedHours} 小时 · {activePath.status}</small></div>}
            {milestones.map((milestone) => (
              <div className={`milestone-item ${milestone.status}`} key={milestone.id}>
                <div className="milestone-index">{milestone.orderIndex + 1}</div>
                <div className="milestone-body"><strong>{milestone.title}</strong><p>{milestone.outcome}</p><small>{milestone.estimatedMinutes}分钟 · 证据：{milestone.evidenceRequired.join('、')}</small></div>
                {['available', 'doing'].includes(milestone.status) && <button className="milestone-complete-btn" onClick={() => void completeMilestone(milestone.id)}>完成</button>}
                {milestone.status === 'completed' && <span className="completed-pill">已完成</span>}
              </div>
            ))}
          </>
        )}

        {tab === 'tasks' && (
          <>
            <ModuleHeading title="下一步任务" count={tasks.length} showArchived={showArchived} onToggleArchived={setShowArchived} />
            {tasks.length === 0 && <Empty text="直接用自然语言创建目标或练习，任务会出现在这里。" />}
            {tasks.map((task) => (
              <div className={`task-item ${task.status}`} key={task.id}>
                <button className="task-check" title={task.status === 'done' ? '重新打开' : '标记完成'} disabled={task.status === 'archived'} onClick={() => task.status === 'done' ? void updateTask({ taskId: task.id, status: 'todo' }) : void completeTask(task.id)}>{task.status === 'done' ? '✓' : ''}</button>
                <div className="module-main"><strong>{task.title}</strong><p>{task.description}</p><small>{stageLabel(task.stage)} · {task.estimatedMinutes}分钟 · 优先级{task.priority}{task.dueAt ? ` · ${formatDate(task.dueAt)}` : ''}</small></div>
                <details className="item-actions"><summary>···</summary><div>{(['todo', 'doing', 'blocked'] as TaskStatus[]).map((status) => <button key={status} onClick={() => void updateTask({ taskId: task.id, status })}>{taskStatusLabel(status)}</button>)}<button onClick={() => void updateTask({ taskId: task.id, status: task.status === 'archived' ? 'todo' : 'archived' })}>{task.status === 'archived' ? '恢复' : '归档'}</button></div></details>
              </div>
            ))}
          </>
        )}

        {tab === 'habits' && (
          <>
            <div className="habits-panel-head">
              <div>
                <h2>微习惯</h2>
                <span className="habits-panel-subtitle">小到不可能失败的学习行为</span>
              </div>
              <div className="habits-panel-actions">
                <button className="text-button" onClick={() => setShowArchived((value) => !value)}>{showArchived ? '隐藏退役' : '显示退役'}</button>
                <button className="habits-create-toggle" onClick={() => { setHabitEditingId(undefined); setHabitCreating((value) => !value); }}>{habitCreating ? '取消' : '设计配方'}</button>
              </div>
            </div>

            {/* Behavior state — quiet inline whisper, not a heavy grid */}
            <div className="habits-state-bar">
              <span className="habits-state-item">动机 <strong>{Math.round(behaviorState.motivation * 100)}%</strong></span>
              <span className="habits-state-sep">·</span>
              <span className="habits-state-item">能力 <strong>{Math.round(behaviorState.ability * 100)}%</strong></span>
              <span className="habits-state-sep">·</span>
              <span className="habits-state-item">提示 <strong>{Math.round(behaviorState.promptReliability * 100)}%</strong></span>
              <span className="habits-state-sep">·</span>
              <span className="habits-state-item">成功率 <strong>{Math.round(behaviorState.successRate * 100)}%</strong></span>
            </div>

            {/* Today's tiny action — the hero nudge, warm and personal */}
            <div className="habits-tiny-nudge">
              <span className="habits-tiny-label">当前最小行动</span>
              <p className="habits-tiny-action">{behaviorState.suggestedTinyAction}</p>
              {behaviorState.diagnosis.slice(0, 2).map((item) => (
                <p className="habits-tiny-hint" key={item}>{item}</p>
              ))}
            </div>

            {/* ── Habit form (create / edit) · guided step-by-step ── */}
            {habitCreating && selectedGoalId && (
              <form className="habits-edit-form" onSubmit={(event) => {
                event.preventDefault();
                const operation = habitEditingId
                  ? updateHabit({ habitId: habitEditingId, ...habitForm })
                  : createHabit({ ...habitForm, goalId: selectedGoalId });
                void operation.then(() => {
                  setHabitCreating(false);
                  setHabitEditingId(undefined);
                  setHabitForm({ title: '', anchor: '我打开当前学习目标后', tinyBehavior: '', expansionBehavior: '', celebration: '轻轻点头，对自己说"我已经开始了"', frequency: 'daily', customDays: [], minimumSeconds: 30, preferredMinutes: 10 });
                });
              }}>
                {/* Warm intro */}
                <div className="habits-edit-intro">
                  <span className="habits-edit-intro-icon">⚡</span>
                  <div>
                    <strong>B.J. Fogg 行为模型</strong>
                    <p>行为 = 动机 × 能力 × 提示。把行为缩到最小，接上稳定锚点，即时庆祝。小到不可能失败。</p>
                  </div>
                </div>

                {/* Step ① — Name */}
                <div className="habits-edit-step">
                  <span className="habits-edit-step-num">①</span>
                  <div className="habits-edit-step-body">
                    <span className="habits-edit-label">这个习惯叫什么？</span>
                    <input required value={habitForm.title} onChange={(event) => setHabitForm((current) => ({ ...current, title: event.target.value }))} placeholder="给习惯起个名字，简短就好" />
                  </div>
                </div>

                {/* Step ② — Anchor (trigger) */}
                <div className="habits-edit-step">
                  <span className="habits-edit-step-num">②</span>
                  <div className="habits-edit-step-body">
                    <span className="habits-edit-label">什么时候触发？</span>
                    <p className="habits-edit-hint">找一个每天稳定发生的事作为锚点。它一发生，你就想起这个习惯。</p>
                    <div className="habits-edit-sentence">
                      <span className="habits-edit-sentence-word">当</span>
                      <input required value={habitForm.anchor} onChange={(event) => setHabitForm((current) => ({ ...current, anchor: event.target.value }))} placeholder="我喝完早晨第一杯水后" />
                    </div>
                  </div>
                </div>

                {/* Step ③ — Tiny behavior */}
                <div className="habits-edit-step">
                  <span className="habits-edit-step-num">③</span>
                  <div className="habits-edit-step-body">
                    <span className="habits-edit-label">你要做什么？</span>
                    <p className="habits-edit-hint">小到低能量日也能完成。如果觉得"这也太简单了"，那就对了。</p>
                    <div className="habits-edit-sentence">
                      <span className="habits-edit-sentence-word">我就</span>
                      <textarea required value={habitForm.tinyBehavior} onChange={(event) => setHabitForm((current) => ({ ...current, tinyBehavior: event.target.value }))} placeholder="只打开编辑器，读一行 TODO" rows={2} />
                    </div>
                  </div>
                </div>

                {/* Step ④ — Celebration */}
                <div className="habits-edit-step">
                  <span className="habits-edit-step-num">④</span>
                  <div className="habits-edit-step-body">
                    <span className="habits-edit-label">完成后怎么庆祝？</span>
                    <p className="habits-edit-hint">即时庆祝，哪怕只是心里说一句话。大脑会把行为和积极情绪绑定在一起。</p>
                    <div className="habits-edit-sentence">
                      <span className="habits-edit-sentence-word">然后</span>
                      <input required value={habitForm.celebration} onChange={(event) => setHabitForm((current) => ({ ...current, celebration: event.target.value }))} placeholder="轻轻点头，对自己说「已经开始了」" />
                    </div>
                  </div>
                </div>

                {/* Step ⑤ — Expansion (optional) */}
                <div className="habits-edit-step">
                  <span className="habits-edit-step-num">⑤</span>
                  <div className="habits-edit-step-body">
                    <span className="habits-edit-label">状态好时想多做一点？</span>
                    <p className="habits-edit-hint">完全可选。不做也不算失败。有时候最小的那一步会自然带你走得更远。</p>
                    <div className="habits-edit-sentence">
                      <span className="habits-edit-sentence-word">还可以</span>
                      <textarea value={habitForm.expansionBehavior} onChange={(event) => setHabitForm((current) => ({ ...current, expansionBehavior: event.target.value }))} placeholder="如果顺手就写 10 分钟代码" rows={2} />
                    </div>
                  </div>
                </div>

                {/* Live recipe preview — integrated, prominent */}
                <div className="habits-edit-preview">
                  <div className="habits-edit-preview-head">
                    <span className="habits-edit-preview-dot" />
                    <span>配方预览</span>
                  </div>
                  <div className="habits-edit-preview-card">
                    <p className="habits-edit-preview-recipe">
                      <b>当</b> {habitForm.anchor || '…'}<br />
                      <b>我就</b> {habitForm.tinyBehavior || '…'}<br />
                      <b>然后</b> {habitForm.celebration || '…'}
                    </p>
                    {habitForm.expansionBehavior && (
                      <p className="habits-edit-preview-expand">状态好时：{habitForm.expansionBehavior}</p>
                    )}
                  </div>
                </div>

                {/* Step ⑥ — Rhythm */}
                <div className="habits-edit-step">
                  <span className="habits-edit-step-num">⑥</span>
                  <div className="habits-edit-step-body">
                    <span className="habits-edit-label">频率与时长</span>
                    {/* Frequency — segmented control */}
                    <div className="habits-edit-freq">
                      {([
                        ['daily', '每天'],
                        ['weekdays', '工作日'],
                        ['weekly', '每周'],
                        ['custom', '自定义']
                      ] as Array<[HabitFrequency, string]>).map(([value, label]) => (
                        <button
                          type="button"
                          key={value}
                          className={`habits-edit-freq-btn ${habitForm.frequency === value ? 'active' : ''}`}
                          onClick={() => setHabitForm((current) => ({ ...current, frequency: value, customDays: value === 'weekly' && current.customDays.length === 0 ? [1] : current.customDays }))}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {/* Day picker for weekly/custom */}
                    {['weekly', 'custom'].includes(habitForm.frequency) && (
                      <div className="weekday-picker" style={{marginTop: 10}}>
                        {['日','一','二','三','四','五','六'].map((label, day) => (
                          <button type="button" key={day} className={habitForm.customDays.includes(day) ? 'active' : ''} onClick={() => setHabitForm((current) => ({ ...current, customDays: current.frequency === 'weekly' ? [day] : current.customDays.includes(day) ? current.customDays.filter((item) => item !== day) : [...current.customDays, day].sort() }))}>周{label}</button>
                        ))}
                      </div>
                    )}
                    {/* Duration */}
                    <div className="habits-edit-duration">
                      <label>
                        最少
                        <select value={habitForm.minimumSeconds} onChange={(event) => setHabitForm((current) => ({ ...current, minimumSeconds: Number(event.target.value) }))}>
                          {[5, 10, 15, 30, 60, 120].map((v) => <option key={v} value={v}>{v <= 60 ? `${v}秒` : `${v / 60}分钟`}</option>)}
                        </select>
                      </label>
                      <span className="habits-edit-duration-sep">—</span>
                      <label>
                        理想
                        <select value={habitForm.preferredMinutes} onChange={(event) => setHabitForm((current) => ({ ...current, preferredMinutes: Number(event.target.value) }))}>
                          {[1, 5, 10, 15, 20, 30, 45, 60, 90, 120, 180].map((v) => <option key={v} value={v}>{v}分钟</option>)}
                        </select>
                      </label>
                    </div>
                  </div>
                </div>

                <button type="submit" className="habits-edit-submit" disabled={!habitForm.title.trim() || !habitForm.tinyBehavior.trim() || (['weekly', 'custom'].includes(habitForm.frequency) && habitForm.customDays.length === 0)}>
                  {habitEditingId ? '保存修改' : '✨ 开始这个习惯'}
                </button>
              </form>
            )}

            {/* ── Empty state ── */}
            {habits.length === 0 && !habitCreating && (
              <div className="habits-empty">
                <div className="habits-empty-mark">⚡</div>
                <strong>还没有习惯配方</strong>
                <p>设计一个小到几乎不需要动机的学习行为，把它连接到每天稳定发生的锚点。</p>
              </div>
            )}

            {/* ── Habit cards · flowing recipe style ── */}
            {habits.map((habit) => {
              const today = localDateKey(new Date());
              const todayEntry = habitCheckIns.find((entry) => entry.habitId === habit.id && entry.localDate === today);
              const condition = habitConditions[habit.id] ?? { motivation: 3, ability: 3, promptSeen: true };
              const updateCondition = (patch: Partial<typeof condition>) => setHabitConditions((current) => ({ ...current, [habit.id]: { ...condition, ...patch } }));
              return (
                <div className={`habits-card ${habit.status} ${todayEntry ? 'done-today' : ''}`} key={habit.id}>
                  {/* Header — name + streak */}
                  <div className="habits-card-head">
                    <strong>{habit.title}</strong>
                    {habit.status === 'active' && (
                      <span className="habits-streak">
                        <span className="habits-streak-fire">{habit.streak >= 7 ? '🔥' : habit.streak >= 3 ? '⚡' : '·'}</span>
                        {habit.streak} 天
                      </span>
                    )}
                    {habit.status === 'paused' && <span className="habits-badge muted">已暂停</span>}
                    {habit.status === 'retired' && <span className="habits-badge muted">已退役</span>}
                  </div>

                  {/* Recipe — flowing natural language */}
                  <p className="habits-card-recipe">
                    <b>当</b> {habit.anchor}<br />
                    <b>我就</b> {habit.tinyBehavior}<br />
                    <b>然后</b> {habit.celebration}
                  </p>
                  {habit.expansionBehavior && (
                    <p className="habits-card-expand">状态好时：{habit.expansionBehavior}</p>
                  )}

                  {/* Today's status */}
                  {todayEntry ? (
                    <div className="habits-card-today done">
                      <span className="habits-today-icon">✓</span>
                      {todayEntry.result === 'done' ? '今天已完成' : todayEntry.result === 'partial' ? '今天做了一部分' : '今天跳过了'}
                      {todayEntry.celebrated && ' · 已庆祝'}
                    </div>
                  ) : habit.status === 'active' ? (
                    <div className="habits-card-today pending">
                      <span className="habits-today-icon">○</span>
                      今天还没有记录
                    </div>
                  ) : null}

                  {/* Check-in actions */}
                  {!todayEntry && habit.status === 'active' && (
                    <>
                      {/* Condition capture — inline, not hidden in details */}
                      <details className="habits-condition">
                        <summary>记录当时状态（可选）</summary>
                        <div className="habits-condition-grid">
                          <label>动机<select value={condition.motivation} onChange={(event) => updateCondition({ motivation: Number(event.target.value) })}>{[1,2,3,4,5].map((v) => <option key={v} value={v}>{v} · {v <= 2 ? '低' : v === 3 ? '中' : '高'}</option>)}</select></label>
                          <label>容易程度<select value={condition.ability} onChange={(event) => updateCondition({ ability: Number(event.target.value) })}>{[1,2,3,4,5].map((v) => <option key={v} value={v}>{v} · {v <= 2 ? '难' : v === 3 ? '中' : '易'}</option>)}</select></label>
                          <label className="habits-condition-check"><input type="checkbox" checked={condition.promptSeen} onChange={(event) => updateCondition({ promptSeen: event.target.checked })} />锚点提示出现了</label>
                        </div>
                      </details>

                      <div className="habits-card-actions">
                        <button
                          className="habits-action-primary"
                          onClick={() => void checkInHabit({ habitId: habit.id, result: 'done', motivation: condition.motivation, ability: condition.ability, promptSeen: condition.promptSeen, celebrated: true, durationSeconds: habit.minimumSeconds, note: `完成最小版本；庆祝：${habit.celebration}` })}
                        >
                          完成并庆祝
                        </button>
                        <button
                          className="habits-action-secondary"
                          onClick={() => void checkInHabit({ habitId: habit.id, result: 'partial', motivation: condition.motivation, ability: condition.ability, promptSeen: condition.promptSeen, celebrated: false, durationSeconds: Math.max(5, Math.floor(habit.minimumSeconds / 2)), note: '只完成一部分；下一次继续缩小动作' })}
                        >
                          只做了一点
                        </button>
                        <button
                          className="habits-action-skip"
                          onClick={() => void checkInHabit({ habitId: habit.id, result: 'skipped', motivation: condition.motivation, ability: condition.ability, promptSeen: condition.promptSeen, celebrated: false, durationSeconds: 0, note: '本次未发生；不补偿，下一次回到最小版本' })}
                        >
                          今天没做
                        </button>
                      </div>
                    </>
                  )}

                  {/* Footer — stats + management */}
                  <div className="habits-card-foot">
                    <span className="habits-card-stats">最小 {habit.minimumSeconds}秒 · 理想 {habit.preferredMinutes}分钟 · 最佳 {habit.bestStreak}天</span>
                    <span className="habits-card-mgmt">
                      <button className="text-button" onClick={() => { setHabitEditingId(habit.id); setHabitCreating(true); setHabitForm({ title: habit.title, anchor: habit.anchor, tinyBehavior: habit.tinyBehavior, expansionBehavior: habit.expansionBehavior, celebration: habit.celebration, frequency: habit.frequency, customDays: habit.customDays, minimumSeconds: habit.minimumSeconds, preferredMinutes: habit.preferredMinutes }); }}>编辑</button>
                      <button className="text-button" onClick={() => void updateHabit({ habitId: habit.id, status: habit.status === 'active' ? 'paused' : 'active' })}>{habit.status === 'active' ? '暂停' : '恢复'}</button>
                      <button className="text-button" onClick={() => void updateHabit({ habitId: habit.id, status: habit.status === 'retired' ? 'active' : 'retired' })}>{habit.status === 'retired' ? '重新启用' : '退役'}</button>
                    </span>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {tab === 'focus' && (
          <>
            <div className="focus-panel-head">
              <div>
                <h2>专注</h2>
                <span className="focus-panel-subtitle">每一次专注都是对深度思考的训练</span>
              </div>
            </div>

            {/* Weekly stats — quiet summary */}
            <div className="focus-stats-bar">
              <div className="focus-stat">
                <strong>{scopedSessions.filter((s) => s.status === 'completed').length}</strong>
                <span>已完成</span>
              </div>
              <div className="focus-stat">
                <strong>{scopedSessions.reduce((sum, s) => sum + (s.actualMinutes || 0), 0)}</strong>
                <span>专注分钟</span>
              </div>
              <div className="focus-stat">
                <strong>{scopedSessions.filter((s) => s.status === 'active').length}</strong>
                <span>进行中</span>
              </div>
            </div>

            {/* Active session — hero display */}
            {scopedSessions.filter((s) => s.status === 'active').map((session) => (
              <div className="focus-active-card" key={session.id}>
                <div className="focus-active-indicator">
                  <span className="focus-active-dot" />
                  <span>正在专注</span>
                </div>
                <strong className="focus-active-objective">{session.objective}</strong>
                <div className="focus-active-meta">
                  <span>{sessionModeLabel(session.mode)}</span>
                  <span>·</span>
                  <span>计划 {session.plannedMinutes} 分钟</span>
                  {session.actualMinutes > 0 && <span>· 已过 {session.actualMinutes} 分钟</span>}
                </div>
              </div>
            ))}

            {/* Completed sessions — quiet timeline */}
            {scopedSessions.filter((s) => s.status !== 'active').length > 0 && (
              <div className="focus-timeline-head">
                <span>最近会话</span>
              </div>
            )}
            {scopedSessions.filter((s) => s.status !== 'active').slice(0, 12).map((session) => (
              <div className={`focus-session-item ${session.status}`} key={session.id}>
                <div className="focus-session-left">
                  <span className={`focus-session-dot ${session.status}`} />
                  <div className="focus-session-line" />
                </div>
                <div className="focus-session-body">
                  <div className="focus-session-head">
                    <strong>{session.objective}</strong>
                    <span className={`focus-session-badge ${session.status}`}>
                      {session.status === 'completed' ? '已完成' : session.status === 'abandoned' ? '已放弃' : session.status}
                    </span>
                  </div>
                  <p className="focus-session-mode">
                    {sessionModeLabel(session.mode)}
                    <span>·</span>
                    计划 {session.plannedMinutes} 分钟
                    {session.actualMinutes > 0 && <span>· 实际 {session.actualMinutes} 分钟</span>}
                  </p>
                  {session.summary && (
                    <p className="focus-session-summary">{session.summary}</p>
                  )}
                  <time className="focus-session-time">
                    {session.startedAt ? formatDate(session.startedAt) : ''}
                    {session.endedAt && ` → ${formatDate(session.endedAt)}`}
                  </time>
                </div>
              </div>
            ))}

            {scopedSessions.length === 0 && (
              <div className="focus-empty">
                <div className="focus-empty-mark">🧘</div>
                <strong>还没有专注会话</strong>
                <p>在对话中说"开始一段专注学习"或"帮我规划一次学习会话"，AI 会帮你建立专注时段。</p>
              </div>
            )}
          </>
        )}

        {tab === 'review' && (
          <>
            <div className="review-panel-head">
              <div>
                <h2>间隔复习</h2>
                <span className="review-panel-subtitle">用正确的时机巩固记忆，在遗忘之前唤醒</span>
              </div>
              <div className="review-panel-actions">
                <button className="text-button" onClick={() => setShowArchived((value) => !value)}>{showArchived ? '隐藏已暂停' : '显示已暂停'}</button>
              </div>
            </div>

            {/* Stats — quiet whisper */}
            {reviews.length > 0 && (
              <div className="review-stats-bar">
                <span className="review-stat due">
                  <strong>{allReviews.filter((r) => !r.suspended && new Date(r.dueAt) <= new Date()).length}</strong> 待复习
                </span>
                <span className="review-stat-sep">·</span>
                <span className="review-stat">
                  <strong>{allReviews.filter((r) => !r.suspended).length}</strong> 活跃
                </span>
                <span className="review-stat-sep">·</span>
                <span className="review-stat">
                  <strong>{allReviews.filter((r) => r.suspended).length}</strong> 已暂停
                </span>
              </div>
            )}

            {reviews.length === 0 && (
              <div className="review-empty">
                <div className="review-empty-mark">🧠</div>
                <strong>还没有复习卡片</strong>
                <p>解释或验证知识后，系统会自动建立间隔复习队列。在正确的时机回来，记忆才能长存。</p>
              </div>
            )}

            {/* Review cards */}
            {reviews.map((item) => {
              const isDue = !item.suspended && new Date(item.dueAt) <= new Date();
              const isSuspended = item.suspended;
              return (
                <div className={`review-card ${isDue ? 'due' : ''} ${isSuspended ? 'suspended' : ''}`} key={item.id}>
                  {/* Prompt — the hero */}
                  <div className="review-card-head">
                    <p className="review-card-prompt">{item.prompt}</p>
                    <span className={`review-card-badge ${isDue ? 'due' : isSuspended ? 'suspended' : 'future'}`}>
                      {isSuspended ? '已暂停' : isDue ? '现在复习' : formatDate(item.dueAt)}
                    </span>
                  </div>

                  {/* Answer — hidden until recall attempt */}
                  <details className="review-card-answer">
                    <summary>回忆后查看答案</summary>
                    <p>{item.answer}</p>
                  </details>

                  {/* Rating — conversational, emoji-led */}
                  {!isSuspended && (
                    <div className="review-rating">
                      <span className="review-rating-label">你记得怎么样？</span>
                      <div className="review-rating-row">
                        {([
                          ['again', '😰', '忘了'],
                          ['hard', '🤔', '费力'],
                          ['good', '👍', '记得'],
                          ['easy', '✨', '轻松']
                        ] as Array<[ReviewRating, string, string]>).map(([rating, emoji, label]) => (
                          <button
                            key={rating}
                            className={`review-rating-btn ${rating}`}
                            onClick={() => void recordReview(item.id, rating)}
                          >
                            <span className="review-rating-emoji">{emoji}</span>
                            <span className="review-rating-label-text">{label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Footer — whisper metadata */}
                  <div className="review-card-foot">
                    <span className="review-card-meta">
                      间隔 {formatInterval(item.intervalDays)} · 遗忘 {item.lapses} 次
                      {item.lastRating && ` · 上次 ${ratingLabelText(item.lastRating)}`}
                    </span>
                    <button
                      className="text-button"
                      onClick={() => void suspendReview({ itemId: item.id, suspended: !item.suspended })}
                    >
                      {isSuspended ? '恢复' : '暂停'}
                    </button>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {tab === 'knowledge' && (
          <>
            <PanelHeading title="动态知识地图" count={nodes.length} />
            {nodes.length === 0 && <Empty text="创建学习计划后，系统会生成知识节点与依赖关系。" />}
            {nodes.map((node) => <div className="knowledge-item" key={node.id}><div className="knowledge-head"><strong>{node.title}</strong><span>{Math.round(node.mastery * 100)}%</span></div><p>{node.summary}</p><div className="mastery-track"><span style={{ width: `${Math.max(3, node.mastery * 100)}%` }} /></div><small>{stageLabel(node.stage)} · 置信 {Math.round(node.confidence * 100)}%</small></div>)}
            {misconceptions.length > 0 && <h3 className="section-subtitle">误解修复队列</h3>}
            {misconceptions.map((item) => (
              <div className={`misconception-item ${item.status}`} key={item.id}><div className="module-heading-row"><strong>{item.statement}</strong><span>{misconceptionStatusLabel(item.status)}</span></div><p>{item.correction}</p><small>需要：{item.evidenceNeeded || '补充反例或独立解释'}</small><div className="segmented-actions"><button onClick={() => void updateMisconception({ misconceptionId: item.id, status: 'testing' })}>验证中</button><button onClick={() => void updateMisconception({ misconceptionId: item.id, status: 'resolved' })}>已解决</button><button onClick={() => void updateMisconception({ misconceptionId: item.id, status: item.status === 'recurring' ? 'open' : 'recurring' })}>{item.status === 'recurring' ? '转为待修复' : '标记复发'}</button></div></div>
            ))}
          </>
        )}

        {tab === 'library' && (
          <>
            <div className="panel-heading">
              <h2>个人资料库</h2>
              <div>
                <button className="text-button" onClick={() => setShowArchived((value) => !value)}>{showArchived ? '隐藏归档' : '显示归档'}</button>
                <button className="primary-button library-import-btn" onClick={() => void importResources()}>导入资料</button>
              </div>
            </div>
            <div className="library-search">
              <input
                value={libraryQuery}
                onChange={(event) => setLibraryQuery(event.target.value)}
                placeholder="搜索资料…"
                onKeyDown={(event) => { if (event.key === 'Enter' && libraryQuery.trim()) void searchLibrary(libraryQuery).then(setLibraryHits); }}
              />
              <button className="library-search-btn" disabled={!libraryQuery.trim()} onClick={async () => setLibraryHits(await searchLibrary(libraryQuery))}>搜索</button>
            </div>
            {libraryHits.length > 0 && (
              <div className="panel-heading" style={{marginTop: 8}}><h2>搜索结果</h2><button className="text-button" onClick={() => { setLibraryHits([]); setLibraryQuery(''); }}>清除</button></div>
            )}
            {libraryHits.map((hit) => <div className="resource-hit" key={hit.chunkId}><strong>{hit.resourceTitle}</strong><p>{hit.content.slice(0, 360)}</p><small>相关度 {hit.score}</small></div>)}
            {libraryHits.length === 0 && resources.map((resource) => <div className={`resource-item ${resource.archived ? 'archived' : ''}`} key={resource.id}><div className="module-heading-row"><strong>{resource.title}</strong><button className="text-button" onClick={() => void archiveResource({ resourceId: resource.id, archived: !resource.archived })}>{resource.archived ? '恢复' : '归档'}</button></div><p>{resource.summary}</p><small>{resource.kind} · {formatBytes(resource.byteSize)} · {resource.chunkCount}片段{resource.archived ? ' · 已归档' : ''}</small></div>)}
            {resources.length === 0 && libraryHits.length === 0 && <Empty text="导入 TXT、Markdown、JSON 或 CSV 资料后，AI 可在本地检索并标注来源。" />}
          </>
        )}

        {tab === 'assessments' && (
          <>
            <ModuleHeading title="真实性能力评估" count={assessments.length} showArchived={showArchived} onToggleArchived={setShowArchived} />
            {assessments.length === 0 && <Empty text="说「考考我」，系统会创建机制、迁移和误解三类评估问题。" />}
            {assessments.map((assessment) => {
              const latest = attempts.find((attempt) => attempt.assessmentId === assessment.id);
              return <div className={`assessment-item ${assessment.status}`} key={assessment.id}>
                <div className="assessment-head"><strong>{assessment.title}</strong><span>{assessmentStatusLabel(assessment.status)}</span></div>
                <p>{assessment.instructions}</p><ol>{assessment.questions.map((question) => <li key={question.id}>{question.prompt}</li>)}</ol>
                {assessment.status !== 'completed' && assessment.status !== 'archived' && <><textarea value={answers[assessment.id] ?? ''} onChange={(event) => setAnswers((current) => ({ ...current, [assessment.id]: event.target.value }))} placeholder="在这里一次性写出你的独立答案…" /><button disabled={!answers[assessment.id]?.trim()} onClick={() => void submitAssessment(assessment.id, answers[assessment.id] ?? '')}>提交评估</button></>}
                {latest && <div className="assessment-result"><strong>{Math.round(latest.score * 100)}分</strong><p>{latest.feedback}</p></div>}
                <button className="text-button" onClick={() => void archiveAssessment({ assessmentId: assessment.id, archived: assessment.status !== 'archived' })}>{assessment.status === 'archived' ? '恢复评估' : '归档评估'}</button>
              </div>;
            })}
          </>
        )}

        {tab === 'artifacts' && (
          <>
            <ModuleHeading title="学习作品" count={artifacts.length} showArchived={showArchived} onToggleArchived={setShowArchived} />
            {artifacts.length === 0 && <Empty text="说「帮我创建一个作品」，系统会建立作品规格和验收标准。" />}
            {artifacts.map((artifact) => {
              const evaluation = dashboard.artifactEvaluations.find((item) => item.artifactId === artifact.id);
              return <div className={`artifact-item ${artifact.status}`} key={artifact.id}>
                <div className="artifact-head"><span>{artifact.kind}</span><strong>{artifact.title}</strong><i>{artifactStatusLabel(artifact.status)}</i></div><p>{artifact.description}</p><ul>{artifact.rubric.map((item) => <li key={item}>{item}</li>)}</ul>
                {artifact.status !== 'archived' && <button onClick={() => void evaluateArtifact(artifact.id)}>按量表验收</button>}
                {evaluation && <small>最近验收 {Math.round(evaluation.score * 100)}% · {evaluation.summary}</small>}
                <button className="text-button" onClick={() => void archiveArtifact({ artifactId: artifact.id, archived: artifact.status !== 'archived' })}>{artifact.status === 'archived' ? '恢复作品' : '归档作品'}</button>
              </div>;
            })}
          </>
        )}

        {tab === 'evidence' && (
          <><PanelHeading title="能力证据" count={evidence.length} />{evidence.length === 0 && <Empty text="完成独立表达、作品或迁移任务后，证据会出现在这里。" />}{evidence.map((item) => <div className="evidence-item" key={item.id}><strong>{item.title}</strong><p>{item.content}</p><div className="score-row"><Score label="独立" value={item.independence} /><Score label="保持" value={item.retention} /><Score label="迁移" value={item.transfer} /></div><small>{item.kind} · {item.evaluator} · {formatDate(item.createdAt)}</small></div>)}</>
        )}

        {tab === 'runs' && (
          <>
            <PanelHeading title="运行与数据安全" count={scopedRuns.length + scopedSessions.filter((item) => item.status === 'active').length} />
            <div className={`maintenance-card ${dashboard.maintenance.integrity}`}>
              <div className="maintenance-status">
                <span className={`integrity-dot ${dashboard.maintenance.integrity}`} />
                <div>
                  <strong>本地数据库</strong>
                  <span>{dashboard.maintenance.integrity === 'ok' ? '完整' : '需检查'}</span>
                </div>
              </div>
              <p>{dashboard.maintenance.integrityMessage}</p>
              <div className="maintenance-metrics">
                <div><span>Schema</span><strong>v{dashboard.maintenance.schemaVersion}</strong></div>
                <div><span>大小</span><strong>{formatBytes(dashboard.maintenance.databaseSizeBytes)}</strong></div>
                <div><span>备份</span><strong>{dashboard.maintenance.backupCount} 份</strong></div>
                <div><span>最近备份</span><strong>{dashboard.maintenance.lastBackupAt ? formatCompactDate(dashboard.maintenance.lastBackupAt) : '暂无'}</strong></div>
              </div>
              <button className="primary-button backup-btn" onClick={() => void createBackup()}>立即创建备份</button>
              {dashboard.maintenance.backups.length > 0 && (
                <details className="backup-list">
                  <summary>查看与恢复备份</summary>
                  {dashboard.maintenance.backups.slice(0, 8).map((backup) => (
                    <div className="backup-row" key={backup.name}>
                      <span>
                        <strong>{backup.kind === 'manual' ? '手动备份' : '每日备份'}</strong>
                        <small>{formatDate(backup.createdAt)} · {formatBytes(backup.sizeBytes)}</small>
                      </span>
                      <button className="text-button" onClick={() => { if (window.confirm('恢复会替换当前本地数据库并自动重启。系统会先创建一份恢复前备份。确认继续？')) void restoreBackup(backup.name); }}>恢复</button>
                    </div>
                  ))}
                </details>
              )}
            </div>
            {scopedSessions.length > 0 && <div className="section-subtitle">学习会话</div>}
            {scopedSessions.slice(0, 8).map((session) => (
              <div className="session-item" key={session.id}>
                <div className="module-heading-row"><strong>{session.objective}</strong><span className={`session-badge ${session.status}`}>{sessionStatusLabel(session.status)}</span></div>
                <p>{sessionModeLabel(session.mode)} · 计划 {session.plannedMinutes} 分钟{ session.actualMinutes > 0 ? ` · 实际 ${session.actualMinutes} 分钟` : ''}</p>
                {session.summary && <small>{session.summary}</small>}
              </div>
            ))}
            {scopedRuns.length > 0 && <div className="section-subtitle">智能体运行</div>}
            {scopedRuns.map((run) => (
              <div className="run-item" key={run.id}>
                <div className="module-heading-row"><strong>{run.plan.objective}</strong><span className={`run-badge ${run.status}`}>{runStatusLabel(run.status)}</span></div>
                <p>{run.currentStep}/{run.plan.steps.length} 步 · {run.composition.agent}+{run.composition.control}+{run.composition.adaptation}+{run.composition.governance}</p>
                <small>¥{run.costCny.toFixed(4)}{run.error ? ` · ${run.error}` : ''}</small>
              </div>
            ))}
            {scopedRuns.length === 0 && scopedSessions.length === 0 && <Empty text="当前没有正在执行的长程任务。历史数据仍保存在本地数据库与备份中。" />}
          </>
        )}
      </div>
    </aside>
  );
}

function ModuleHeading({ title, count, showArchived, onToggleArchived, archivedLabel = '显示归档' }: { title: string; count: number; showArchived: boolean; onToggleArchived(value: boolean): void; archivedLabel?: string }) { return <div className="panel-heading"><h2>{title}</h2><div><span>{count}</span><button className="text-button" onClick={() => onToggleArchived(!showArchived)}>{showArchived ? '隐藏归档' : archivedLabel}</button></div></div>; }
function PanelHeading({ title, count }: { title: string; count: number }) { return <div className="panel-heading"><h2>{title}</h2><span>{count}</span></div>; }
function Score({ label, value }: { label: string; value: number }) { return <span>{label} {Math.round(value * 100)}%</span>; }
function Empty({ text }: { text: string }) { return <div className="empty-state">{text}</div>; }
function stageLabel(stage: string): string { return ({ curiosity: '好奇', understanding: '理解', mapping: '知识地图', practice: '练习', transfer: '迁移', verification: '验证', research: '研究', creation: '创造', 'system-building': '体系建构' } as Record<string, string>)[stage] ?? stage; }
function goalStatusLabel(status: GoalStatus): string { return ({ active: '进行中', paused: '已暂停', completed: '已完成', archived: '已归档' } as Record<GoalStatus, string>)[status]; }
function taskStatusLabel(status: TaskStatus): string { return ({ todo: '待处理', doing: '进行中', blocked: '受阻', done: '完成', archived: '归档' } as Record<TaskStatus, string>)[status]; }
function misconceptionStatusLabel(status: string): string { return ({ open: '待修复', testing: '验证中', resolved: '已解决', recurring: '再次出现' } as Record<string, string>)[status] ?? status; }
function assessmentStatusLabel(status: string): string { return ({ draft: '草稿', ready: '待作答', completed: '已完成', archived: '已归档' } as Record<string, string>)[status] ?? status; }
function artifactStatusLabel(status: string): string { return ({ draft: '草稿', review: '待修订', accepted: '已验收', archived: '已归档' } as Record<string, string>)[status] ?? status; }
function formatDate(value: string): string { return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)); }
function formatInterval(days: number): string { if (days < 0.1) return '约1小时'; if (days < 1) return `${Math.round(days * 24)}小时`; return `${Math.round(days)}天`; }
function formatBytes(value: number): string { if (value < 1024) return `${value}B`; if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)}KB`; return `${(value / 1024 / 1024).toFixed(1)}MB`; }

function localDateKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function sessionStatusLabel(status: string): string {
  return ({ active: '进行中', completed: '已完成', abandoned: '已放弃' } as Record<string, string>)[status] ?? status;
}
function runStatusLabel(status: string): string {
  return ({ queued: '排队中', planning: '规划中', running: '运行中', paused: '已暂停', 'awaiting-approval': '待批准', completed: '已完成', failed: '失败', cancelled: '已取消' } as Record<string, string>)[status] ?? status;
}
function sessionModeLabel(mode: string): string {
  return ({ focus: '专注', review: '复习', project: '项目', research: '研究', reflection: '反思' } as Record<string, string>)[mode] ?? mode;
}
function formatCompactDate(value: string): string {
  const d = new Date(value);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86_400_000) return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(d);
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}天前`;
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' }).format(d);
}

function coachingStyleLabel(style: string): string {
  return ({ socratic: '苏格拉底追问', direct: '直接指导', balanced: '平衡', project: '项目驱动' } as Record<string, string>)[style] ?? style;
}
function feedbackLabel(pref: string): string {
  return ({ 'evidence-first': '证据优先', gentle: '温和', direct: '直接' } as Record<string, string>)[pref] ?? pref;
}
function ratingLabelText(rating: string): string {
  return ({ again: '忘了', hard: '费力', good: '记得', easy: '轻松' } as Record<string, string>)[rating] ?? rating;
}
