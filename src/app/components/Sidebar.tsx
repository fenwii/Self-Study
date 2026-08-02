import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../store';

export function Sidebar() {
  const dashboard = useAppStore((state) => state.dashboard);
  const selectedGoalId = useAppStore((state) => state.selectedGoalId);
  const archiveVisible = useAppStore((state) => state.archiveVisible);
  const selectGoal = useAppStore((state) => state.selectGoal);
  const createGoal = useAppStore((state) => state.createGoal);
  const setArchiveVisible = useAppStore((state) => state.setArchiveVisible);
  const setSettingsOpen = useAppStore((state) => state.setSettingsOpen);
  const exportWorkspace = useAppStore((state) => state.exportWorkspace);
  const renameGoal = useAppStore((state) => state.renameGoal);
  const archiveGoal = useAppStore((state) => state.archiveGoal);
  const pinConversation = useAppStore((state) => state.pinConversation);
  const [query, setQuery] = useState('');
  const [editingGoalId, setEditingGoalId] = useState<string>();
  const [editingTitle, setEditingTitle] = useState('');
  const [showExport, setShowExport] = useState(false);
  const searchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const focus = () => searchRef.current?.focus();
    window.addEventListener('self-study:focus-goal-search', focus);
    return () => window.removeEventListener('self-study:focus-goal-search', focus);
  }, []);

  const rows = useMemo(() => {
    if (!dashboard) return [];
    const normalized = query.trim().toLocaleLowerCase('zh-CN');
    return dashboard.goals
      .map((goal) => ({ goal, conversation: dashboard.conversations.find((item) => item.goalId === goal.id) }))
      .filter(({ goal, conversation }) => {
        if (!archiveVisible && goal.status === 'archived') return false;
        if (!normalized) return true;
        return `${goal.title} ${goal.description} ${goal.desiredOutcome} ${conversation?.lastMessagePreview ?? ''}`.toLocaleLowerCase('zh-CN').includes(normalized);
      })
      .sort((a, b) => {
        if (a.goal.status !== b.goal.status) return a.goal.status === 'archived' ? 1 : -1;
        if (Boolean(a.conversation?.pinned) !== Boolean(b.conversation?.pinned)) return a.conversation?.pinned ? -1 : 1;
        return new Date(b.conversation?.lastOpenedAt ?? b.conversation?.lastMessageAt ?? b.goal.updatedAt).getTime()
          - new Date(a.conversation?.lastOpenedAt ?? a.conversation?.lastMessageAt ?? a.goal.updatedAt).getTime();
      });
  }, [archiveVisible, dashboard, query]);

  if (!dashboard) return <aside className="sidebar skeleton" />;
  const archivedCount = dashboard.goals.filter((goal) => goal.status === 'archived').length;

  const commitRename = async (goalId: string) => {
    const title = editingTitle.trim();
    if (title) await renameGoal(goalId, title);
    setEditingGoalId(undefined);
    setEditingTitle('');
  };

  return (
    <aside className="sidebar">
      <div className="brand compact-brand">
        <div className="brand-mark">S</div>
        <div><strong>Self-Study</strong><span>长期自学空间</span></div>
      </div>

      <div className="sidebar-primary-actions">
        <button className="new-goal-button" onClick={() => { void createGoal('新目标'); }}>
          新建目标
        </button>
        <button className="square-button" title="搜索（⌘ K）" onClick={() => searchRef.current?.focus()}>⌕</button>
      </div>
      <div className="goal-search">
        <input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索" />
        {query && <button aria-label="清除搜索" onClick={() => setQuery('')}>×</button>}
      </div>

      <div className="sidebar-section-title"><span>{archiveVisible ? '全部目标' : '目标'}</span><small>{rows.length}</small></div>
      <nav className="goal-list">
        {rows.map(({ goal, conversation }) => (
          <div className={`goal-row ${selectedGoalId === goal.id ? 'active' : ''} ${goal.status === 'archived' ? 'archived' : ''}`} key={goal.id}>
            {editingGoalId === goal.id ? (
              <form className="goal-rename" onSubmit={(event) => { event.preventDefault(); void commitRename(goal.id); }}>
                <input autoFocus value={editingTitle} onChange={(event) => setEditingTitle(event.target.value)} onBlur={() => void commitRename(goal.id)} onKeyDown={(event) => { if (event.key === 'Escape') setEditingGoalId(undefined); }} />
              </form>
            ) : (
              <button className="goal-card" onClick={() => selectGoal(goal.id)}>
                <span className="goal-card-row">
                  <span className="goal-title">{conversation?.pinned && <i className="pin-mark">●</i>}{goal.title}</span>
                  {conversation?.lastMessageAt && <time>{formatCompact(conversation.lastMessageAt)}</time>}
                </span>
                <span className="goal-preview">{conversation?.draft ? `草稿 · ${conversation.draft.replace(/\s+/gu, ' ').slice(0, 36)}` : conversation?.lastMessagePreview?.replace(/\s+/gu, ' ').slice(0, 48) || goal.desiredOutcome?.slice(0, 48)}</span>
                {goal.status === 'archived' && <span className="goal-card-footer"><span>已归档</span></span>}
              </button>
            )}
            <details className="goal-menu" onClick={(event) => event.stopPropagation()}>
              <summary aria-label="目标操作">···</summary>
              <div>
                {conversation && goal.status !== 'archived' && <button onClick={() => void pinConversation(conversation.id, !conversation.pinned)}>{conversation.pinned ? '取消置顶' : '置顶'}</button>}
                <button onClick={() => { setEditingGoalId(goal.id); setEditingTitle(goal.title); }}>{'重命名'}</button>
                <button onClick={() => void archiveGoal(goal.id, goal.status !== 'archived')}>{goal.status === 'archived' ? '恢复' : '归档'}</button>
              </div>
            </details>
          </div>
        ))}
        {rows.length === 0 && <div className="sidebar-empty">没有匹配的目标</div>}
      </nav>

      <div className="sidebar-spacer" />
      {archivedCount > 0 && <button className="sidebar-action archive-toggle" onClick={() => setArchiveVisible(!archiveVisible)}>{archiveVisible ? '隐藏已归档' : `已归档 ${archivedCount}`}</button>}
      <div className="sidebar-summary">
        <span>{dashboard.metrics.dueReviews} 项待复习</span>
        <span>独立性 {dashboard.metrics.independenceScore}%</span>
      </div>
      {/* Export — multi-format, Zhang Xiaolong expandable */}
      <div className="sidebar-export">
        <button
          className={`sidebar-action export-toggle ${showExport ? 'active' : ''}`}
          onClick={() => setShowExport((v) => !v)}
        >
          导出
          <span className="export-arrow">{showExport ? '▾' : '▸'}</span>
        </button>
        {showExport && (
          <div className="export-options">
            <p className="export-intro">{selectedGoalId ? '仅导出当前选中目标的内容。' : '未选中目标，将导出全部内容。'}</p>
            <div className="export-formats">
              {[
                ['json', '📋', 'JSON', '完整数据备份，可恢复'],
                ['markdown', '📝', 'Markdown', '排版阅读笔记，适合归档'],
                ['html', '🌐', 'HTML', '网页存档，可浏览器查看'],
                ['text', '📄', '纯文本', '通用格式，任何编辑器打开']
              ].map(([fmt, icon, name, desc]) => {
                const goal = selectedGoalId ? dashboard.goals.find((g) => g.id === selectedGoalId) : undefined;
                return (
                  <button key={fmt} className="export-format-card" onClick={() => { void exportWorkspace({ format: fmt, goalName: goal?.title, goalId: goal?.id }); setShowExport(false); }}>
                    <span className="export-format-icon">{icon}</span>
                    <div className="export-format-body">
                      <strong>{name}</strong>
                      <span>{desc}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <button className="sidebar-action" onClick={() => setSettingsOpen(true)}>设置 <kbd>⌘,</kbd></button>
    </aside>
  );
}

function formatCompact(value: string): string {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(date);
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' }).format(date);
}
