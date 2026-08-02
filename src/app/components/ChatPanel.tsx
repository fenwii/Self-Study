import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../store';
import { CompositionBar } from './CompositionBar';
import { MarkdownMessage } from './MarkdownMessage';

export function ChatPanel() {
  const dashboard = useAppStore((state) => state.dashboard);
  const selectedGoalId = useAppStore((state) => state.selectedGoalId);
  const sending = useAppStore((state) => state.sending);
  const error = useAppStore((state) => state.error);
  const inspectorOpen = useAppStore((state) => state.inspectorOpen);
  const focusMode = useAppStore((state) => state.focusMode);
  const send = useAppStore((state) => state.send);
  const retryLastMessage = useAppStore((state) => state.retryLastMessage);
  const clearError = useAppStore((state) => state.clearError);
  const saveDraft = useAppStore((state) => state.saveDraft);
  const setInspectorOpen = useAppStore((state) => state.setInspectorOpen);
  const setInspectorTab = useAppStore((state) => state.setInspectorTab);
  const setFocusMode = useAppStore((state) => state.setFocusMode);
  const completeSession = useAppStore((state) => state.completeSession);
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const loadedConversationRef = useRef<string | undefined>(undefined);

  const conversationMessages = useMemo(() => {
    if (!dashboard) return [];
    const scoped = dashboard.messages.filter((message) => selectedGoalId ? message.goalId === selectedGoalId : !message.goalId);
    const query = search.trim().toLocaleLowerCase('zh-CN');
    return query ? scoped.filter((message) => message.content.toLocaleLowerCase('zh-CN').includes(query)) : scoped;
  }, [dashboard, selectedGoalId, search]);

  const scopedRuns = useMemo(() => dashboard?.activeRuns.filter((run) => selectedGoalId ? run.goalId === selectedGoalId : !run.goalId) ?? [], [dashboard, selectedGoalId]);
  const selectedGoal = dashboard?.goals.find((goal) => goal.id === selectedGoalId);
  const conversation = dashboard?.conversations.find((item) => selectedGoalId ? item.goalId === selectedGoalId : !item.goalId);

  useEffect(() => {
    const conversationKey = conversation?.id ?? 'new-goal';
    if (loadedConversationRef.current === conversationKey) return;
    loadedConversationRef.current = conversationKey;
    setInput(conversation?.draft ?? '');
    setSearch('');
    setSearchOpen(false);
    queueMicrotask(() => textareaRef.current?.focus());
  }, [conversation?.draft, conversation?.id]);

  useEffect(() => {
    if (!conversation?.id) return;
    const timer = setTimeout(() => void saveDraft(conversation.id, input).catch(() => undefined), 450);
    return () => clearTimeout(timer);
  }, [conversation?.id, input, saveDraft]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(220, Math.max(54, textarea.scrollHeight))}px`;
  }, [input]);

  useEffect(() => {
    if (!search.trim()) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [conversationMessages.length, scopedRuns.length, selectedGoalId, search]);

  useEffect(() => {
    const focus = () => textareaRef.current?.focus();
    window.addEventListener('self-study:focus-composer', focus);
    return () => window.removeEventListener('self-study:focus-composer', focus);
  }, []);

  if (!dashboard) return <main className="chat-panel skeleton" />;
  const activeSession = dashboard.sessions.find((item) => item.status === 'active' && (selectedGoalId ? item.goalId === selectedGoalId : !item.goalId));
  const nextMilestone = dashboard.milestones.find((item) => item.goalId === selectedGoalId && ['available', 'doing'].includes(item.status));
  const nextTask = dashboard.tasks.find((item) => item.goalId === selectedGoalId && item.status !== 'done');
  const dueReview = dashboard.reviewItems.find((item) => item.goalId === selectedGoalId && !item.suspended && new Date(item.dueAt) <= new Date());
  const openAssessment = dashboard.assessments.find((item) => item.goalId === selectedGoalId && item.status !== 'completed');
  const contract = dashboard.contracts.find((item) => item.goalId === selectedGoalId);
  const activeHabit = dashboard.habits.find((item) => item.goalId === selectedGoalId && item.status === 'active');
  const behaviorState = selectedGoalId ? dashboard.behaviorStates[selectedGoalId] ?? dashboard.behaviorState : dashboard.behaviorState;
  const today = localDateKey(new Date());
  const habitCompletedToday = activeHabit
    ? dashboard.habitCheckIns.some((item) => item.habitId === activeHabit.id && item.result === 'done' && item.localDate === today)
    : false;
  const habitNeedsSupport = behaviorState.motivation < 0.45 || behaviorState.ability < 0.55 || behaviorState.promptReliability < 0.5;
  const suggestedAction = selectedGoal && !contract
    ? '建立一对一学习契约：明确为什么现在学习、怎样算成功、每周真实投入和希望AI如何反馈。'
    : activeHabit && !habitCompletedToday
    ? `完成最小行动：当“${activeHabit.anchor}”，只做“${activeHabit.tinyBehavior}”。完成后立即${activeHabit.celebration}。`
    : habitNeedsSupport
      ? `把下一步缩小：${behaviorState.suggestedTinyAction}`
      : nextMilestone
        ? `继续里程碑：${nextMilestone.title}。${nextMilestone.outcome}`
        : dueReview
          ? `现在复习：${dueReview.prompt}`
          : openAssessment
            ? `完成评估：${openAssessment.title}`
            : nextTask
              ? `完成任务：${nextTask.title}。${nextTask.description}`
              : dashboard.dailyBrief.nextAction;

  const behaviorSuggestion = activeHabit
    ? habitCompletedToday
      ? '我已经完成今天的最小行动，帮我决定是否自然扩展。'
      : '记录我刚刚完成了最小行动。'
    : '帮我为当前目标设计一个30秒微习惯。';
  const suggestions = selectedGoal
    ? [
        suggestedAction,
        ...(contract ? [] : ['建立一对一学习契约，并把时间预算和成功标准写清楚。']),
        behaviorSuggestion,
        habitNeedsSupport ? '诊断我为什么总是无法开始，不要责备我。' : '给我一个十五分钟可以独立完成的练习。',
        '考考我，验证我是否真正掌握了当前内容。'
      ]
    : [];

  const submit = async () => {
    const content = input.trim();
    if (!content) return;
    setInput('');
    await send(content);
  };

  const activeRun = scopedRuns[0];

  return (
    <main className="chat-panel" id="main-content">
      <header className="chat-header natural-header">
        <div className="conversation-title">
          {selectedGoal ? (
            <>
              <span className="eyebrow">学习目标</span>
              <h1>{selectedGoal.title}</h1>
              {selectedGoal.desiredOutcome && <p>{selectedGoal.desiredOutcome}</p>}
            </>
          ) : (
            <>
              <span className="eyebrow">未选择目标</span>
              <h1>从左侧开始</h1>
              <p>点击左侧「新建目标」创建学习目标，或者选择一个已有目标开始对话。</p>
            </>
          )}
        </div>
        <div className="conversation-actions">
          {selectedGoal && <button className={`quiet-button ${inspectorOpen ? 'active' : ''}`} onClick={() => setInspectorOpen(!inspectorOpen)}>进度</button>}
          <button className={`quiet-button ${focusMode ? 'active' : ''}`} onClick={() => setFocusMode(!focusMode)}>{focusMode ? '退出专注' : '专注'}</button>
          <details className="more-popover">
            <summary aria-label="更多设置">···</summary>
            <div>
              <button onClick={() => setSearchOpen((value) => !value)}>搜索当前会话</button>
              <details className="chart-popover nested-chart-popover">
                <summary>CHART组合</summary>
                <CompositionBar />
              </details>
            </div>
          </details>
        </div>
      </header>

      {searchOpen && (
        <div className="conversation-search">
          <input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索当前目标会话" />
          <span>{conversationMessages.length}条</span>
          <button onClick={() => { setSearch(''); setSearchOpen(false); }}>完成</button>
        </div>
      )}

      {selectedGoal && (
        <section className="next-action-card">
          <button className="next-action-main" onClick={() => { if (!contract) { setInspectorTab('contract'); return; } setInput(suggestedAction); textareaRef.current?.focus(); }}>
            <span>下一步</span>
            <strong>{suggestedAction}</strong>
          </button>
          {activeSession && <button className="next-action-secondary" onClick={() => void completeSession('本次专注会话已结束；成果、困难和下一步已进入目标记录。')}>结束专注</button>}
        </section>
      )}

      <div className="message-scroll" ref={scrollRef}>
        {conversationMessages.length === 0 && (
          <div className="conversation-empty natural-empty">
            <div className="empty-orbit">{selectedGoal ? (selectedGoal.title[0] || 'S') : 'S'}</div>
            <h2>{selectedGoal ? `"${selectedGoal.title}"从这里开始` : '从左侧开始'}</h2>
            <p>{selectedGoal
              ? '对话、任务、资料、作品——都只属于这个目标。'
              : '点击左侧「新建目标」创建学习目标。每个目标都是独立的会话空间。'}</p>
          </div>
        )}

        {conversationMessages.map((message) => (
          <article key={message.id} className={`message ${message.role}`}>
            <div className="message-avatar">{message.role === 'user' ? '你' : message.role === 'assistant' ? 'S' : '·'}</div>
            <div className="message-body">
              <div className="message-meta">
                <strong>
                  {message.role === 'user' ? '你' : message.role === 'assistant' ? 'Self-Study' : '系统'}
                  {message.role === 'assistant' && typeof message.metadata?.provider === 'string' && (
                    <span className="model-chip" title={typeof message.metadata.routeReason === 'string' ? message.metadata.routeReason : undefined}>
                      {message.metadata.provider}{typeof message.metadata.model === 'string' ? ` · ${message.metadata.model}` : ''}
                    </span>
                  )}
                </strong>
                <time>{formatTime(message.createdAt)}</time>
              </div>
              <div className="message-content"><MarkdownMessage content={message.content} /></div>
            </div>
          </article>
        ))}

        {activeRun && <ThinkingState runId={activeRun.id} status={activeRun.status} current={activeRun.currentStep} total={activeRun.plan.steps.length} title={activeRun.plan.objective} />}
      </div>

      <div className="suggestion-row" aria-label="建议操作">
        {suggestions.slice(0, selectedGoal ? 4 : 3).map((item) => <button key={item} onClick={() => { setInput(item); textareaRef.current?.focus(); }}>{compactSuggestion(item)}</button>)}
      </div>

      {error && (
        <div className="inline-error" role="alert" aria-live="assertive">
          <span>{error}</span>
          <button onClick={() => void retryLastMessage()}>重试</button>
          <button onClick={clearError}>关闭</button>
        </div>
      )}

      <div className="composer natural-composer">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void submit();
            }
          }}
          placeholder={selectedGoal ? `继续「${selectedGoal.title}」` : '请先在左侧新建或选择一个目标'}
          rows={2}
          disabled={!selectedGoal}
          aria-label="学习消息"
        />
        <div className="composer-footer">
          <span>{conversation?.draft && input ? '草稿已自动保存' : 'Enter发送 · Shift+Enter换行'}</span>
          <div className="composer-tools">
            <span title="支持Markdown和LaTeX">M↓ ∑</span>
            <button disabled={sending || !input.trim() || !selectedGoal} onClick={() => void submit()}>{sending ? '处理中' : '发送'}</button>
          </div>
        </div>
      </div>
    </main>
  );
}

function ThinkingState({ runId, status, current, total, title }: { runId: string; status: string; current: number; total: number; title: string }) {
  const pause = useAppStore((state) => state.pause);
  const resume = useAppStore((state) => state.resume);
  const cancel = useAppStore((state) => state.cancel);
  const progress = total ? Math.round((current / total) * 100) : 0;
  const verb = ({ queued: '正在准备', planning: '正在理解并规划', running: '正在执行学习步骤', paused: '已暂停', 'awaiting-approval': '等待你的确认' } as Record<string, string>)[status] ?? status;

  return (
    <div className="thinking-state" role="status" aria-live="polite">
      <span className={`thinking-pulse ${status}`} />
      <div><strong>{verb}</strong><small>{title} · {current}/{total}步</small></div>
      <div className="thinking-progress"><span style={{ width: `${progress}%` }} /></div>
      <div className="thinking-actions">
        {status === 'paused' ? <button onClick={() => void resume(runId)}>继续</button> : <button onClick={() => void pause(runId)}>暂停</button>}
        <button onClick={() => void cancel(runId)}>取消</button>
      </div>
    </div>
  );
}

function compactSuggestion(value: string): string {
  return value.replace(/^继续里程碑：/u, '继续 ').replace(/^完成任务：/u, '完成 ').replace(/^现在复习：/u, '复习 ').replace(/^完成评估：/u, '评估 ').replace(/^完成最小行动：/u, '微习惯 ').replace(/^把下一步缩小：/u, '缩小 ').split('。')[0]!.slice(0, 28);
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function localDateKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
