import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../store';
import type {
  AppearancePreferences,
  ModelProviderCapabilities,
  ModelProviderConfig,
  ProviderKind,
  ProviderProtocol
} from '../../shared/domain';
import type { ProviderInput } from '../../shared/contracts';

const emptyCapabilities: ModelProviderCapabilities = {
  chat: true,
  reasoning: true,
  toolCalling: true,
  streaming: true,
  vision: false,
  longContext: true,
  structuredOutput: true
};

type ProviderDraft = Omit<ProviderInput, 'id' | 'apiKey'>;
type SettingsTab = 'appearance' | 'models';

export function SettingsModal() {
  const open = useAppStore((state) => state.settingsOpen);
  const setOpen = useAppStore((state) => state.setSettingsOpen);
  const dashboard = useAppStore((state) => state.dashboard);
  const saveAppearance = useAppStore((state) => state.saveAppearance);
  const saveProvider = useAppStore((state) => state.saveProvider);
  const removeProvider = useAppStore((state) => state.removeProvider);
  const testProvider = useAppStore((state) => state.testProvider);
  const setDefaultProvider = useAppStore((state) => state.setDefaultProvider);
  const toggleProvider = useAppStore((state) => state.toggleProvider);
  const [tab, setTab] = useState<SettingsTab>('appearance');
  const [selectedId, setSelectedId] = useState<string>();
  const [draft, setDraft] = useState<ProviderDraft>(() => createCustomDraft());
  const [apiKey, setApiKey] = useState('');
  const [testingId, setTestingId] = useState<string>();
  const providers = dashboard?.providers ?? [];

  useEffect(() => {
    if (!open || !providers.length) return;
    const current = selectedId ? providers.find((item) => item.id === selectedId) : undefined;
    const next = current ?? providers.find((item) => item.isDefault) ?? providers[0];
    if (next) {
      setSelectedId(next.id);
      setDraft(fromProvider(next));
      setApiKey('');
    }
  }, [open, dashboard?.providers]);

  const selected = useMemo(() => providers.find((item) => item.id === selectedId), [providers, selectedId]);

  if (!open || !dashboard) return null;

  const edit = (provider: ModelProviderConfig) => {
    setSelectedId(provider.id);
    setDraft(fromProvider(provider));
    setApiKey('');
  };

  const createCustom = () => {
    setSelectedId(undefined);
    setDraft(createCustomDraft());
    setApiKey('');
  };

  const submit = async (testAfterSave = false) => {
    const saved = await saveProvider({
      ...draft,
      id: selectedId,
      models: draft.models.length ? draft.models : [draft.model],
      baseUrl: draft.baseUrl ?? '',
      envKey: draft.envKey ?? '',
      documentationUrl: draft.documentationUrl ?? '',
      apiKey: apiKey || undefined
    });
    setSelectedId(saved.id);
    setDraft(fromProvider(saved));
    setApiKey('');
    if (testAfterSave) await test(saved.id);
  };

  const test = async (id: string) => {
    setTestingId(id);
    try { await testProvider(id); } finally { setTestingId(undefined); }
  };

  return (
    <div className="modal-backdrop" onMouseDown={() => setOpen(false)}>
      <section className="modal settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="settings-modal-head">
          <div>
            <span className="eyebrow">本地优先设置</span>
            <h2 id="settings-title">设置</h2>
            <p className="modal-lead">界面偏好保存在本机；API密钥仅在Electron主进程中解密。</p>
          </div>
          <button className="icon-button" aria-label="关闭设置" onClick={() => setOpen(false)}>×</button>
        </header>

        <nav className="settings-tabs" aria-label="设置分类">
          <button className={tab === 'appearance' ? 'active' : ''} onClick={() => setTab('appearance')}>外观与阅读</button>
          <button className={tab === 'models' ? 'active' : ''} onClick={() => setTab('models')}>模型与API</button>
        </nav>

        {tab === 'appearance'
          ? <AppearancePanel preferences={dashboard.appearance} onSave={saveAppearance} />
          : (
            <div className="provider-layout">
              <aside className="provider-list provider-catalog">
                <div className="provider-list-head">
                  <strong>模型目录</strong>
                  <button className="mini-button" onClick={createCustom}>＋ 自定义</button>
                </div>
                {providers.map((provider) => (
                  <article
                    className={`provider-card ${provider.id === selectedId ? 'selected' : ''} ${provider.isDefault ? 'default' : ''}`}
                    key={provider.id}
                    onClick={() => edit(provider)}
                  >
                    <div className="provider-main">
                      <div className="provider-title-row">
                        <strong>{provider.name}</strong>
                        {provider.isDefault && <span className="default-badge">默认</span>}
                      </div>
                      <span>{provider.model}</span>
                      <small>{provider.protocol} · P{provider.priority}</small>
                    </div>
                    <div className="provider-status">
                      <span className={`health-dot ${provider.lastTestStatus}`} title={provider.lastError} />
                      <span className={provider.apiKeyStored || provider.kind === 'mock' ? 'ready' : ''}>
                        {provider.kind === 'mock' ? '离线' : provider.apiKeySource === 'environment' ? '环境变量' : provider.apiKeyStored ? '密钥已加密' : '待配置'}
                      </span>
                    </div>
                    <div className="provider-actions" onClick={(event) => event.stopPropagation()}>
                      <button onClick={() => void toggleProvider(provider.id, !provider.enabled)}>{provider.enabled ? '停用' : '启用'}</button>
                      {!provider.isDefault && provider.enabled && <button onClick={() => void setDefaultProvider(provider.id)}>设为默认</button>}
                      <button disabled={testingId === provider.id} onClick={() => void test(provider.id)}>{testingId === provider.id ? '测试中…' : '测试'}</button>
                    </div>
                  </article>
                ))}
              </aside>

              <div className="provider-editor">
                <div className="editor-heading">
                  <div>
                    <span className="eyebrow">{selected?.builtIn ? '官方预置' : '自定义接入'}</span>
                    <h3>{draft.name}</h3>
                  </div>
                  {selected && !selected.isDefault && <button className="danger-link" onClick={() => void removeProvider(selected.id)}>{selected.builtIn ? '清除密钥并停用' : '删除'}</button>}
                </div>

                <div className="form-grid">
                  <label>类型
                    <select value={draft.kind} disabled={Boolean(selected?.builtIn)} onChange={(event) => setDraft({ ...draft, kind: event.target.value as ProviderKind })}>
                      <option value="deepseek">DeepSeek</option><option value="minimax">MiniMax</option><option value="kimi">Kimi</option>
                      <option value="qwen">Qwen</option><option value="step">StepFun</option><option value="glm">GLM</option>
                      <option value="openai">GPT / OpenAI</option><option value="gemini">Gemini</option><option value="anthropic">Claude</option>
                      <option value="openai-compatible">OpenAI兼容</option><option value="mock">本地演示</option>
                    </select>
                  </label>
                  <label>协议
                    <select value={draft.protocol} disabled={Boolean(selected?.builtIn)} onChange={(event) => setDraft({ ...draft, protocol: event.target.value as ProviderProtocol })}>
                      <option value="openai-chat">OpenAI Chat Completions</option>
                      <option value="openai-responses">OpenAI Responses</option>
                      <option value="anthropic-messages">Anthropic Messages</option>
                      <option value="gemini-native">Gemini Native</option>
                      <option value="mock">Mock</option>
                    </select>
                  </label>
                  <label>显示名称<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
                  <label>模型名称
                    <input list="provider-models" value={draft.model} onChange={(event) => setDraft({ ...draft, model: event.target.value })} />
                    <datalist id="provider-models">{draft.models.map((model) => <option value={model} key={model} />)}</datalist>
                  </label>
                  <label className="full">Base URL<input value={draft.baseUrl ?? ''} onChange={(event) => setDraft({ ...draft, baseUrl: event.target.value })} /></label>
                  <label>优先级<input type="number" min={0} max={10000} value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: Number(event.target.value) })} /></label>
                  <label>超时（毫秒）<input type="number" min={5000} max={600000} step={1000} value={draft.timeoutMs} onChange={(event) => setDraft({ ...draft, timeoutMs: Number(event.target.value) })} /></label>
                  <label className="full">API密钥
                    <input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={selected?.apiKeyStored ? '已配置；留空则不修改' : `保存到系统安全存储${draft.envKey ? `，或使用 ${draft.envKey}` : ''}`} />
                  </label>
                </div>

                <div className="capability-row">
                  {(Object.keys(draft.capabilities) as Array<keyof ModelProviderCapabilities>).map((key) => {
                    const enabled = draft.capabilities[key];
                    return (
                      <button
                        type="button"
                        disabled={Boolean(selected?.builtIn)}
                        className={enabled ? 'on' : ''}
                        key={key}
                        onClick={() => setDraft({ ...draft, capabilities: { ...draft.capabilities, [key]: !enabled } })}
                      >
                        {capabilityLabel(key)}
                      </button>
                    );
                  })}
                </div>

                <div className="editor-actions">
                  <button className="primary-button" onClick={() => void submit(false)}>保存配置</button>
                  <button className="secondary-button" disabled={Boolean(testingId)} onClick={() => void submit(true)}>保存并测试</button>
                  {draft.documentationUrl && <button className="secondary-button" onClick={() => window.open(draft.documentationUrl, '_blank', 'noopener,noreferrer')}>官方文档</button>}
                </div>
                <p className="security-note">程序不会内置或上传你的真实API密钥。启用多个云模型后，主模型失败可能把同一任务发送给下一候选供应商。</p>
              </div>
            </div>
          )}
      </section>
    </div>
  );
}

function AppearancePanel({ preferences, onSave }: { preferences: AppearancePreferences; onSave: (value: AppearancePreferences) => Promise<void> }) {
  const update = (patch: Partial<AppearancePreferences>) => void onSave({ ...preferences, ...patch });
  return (
    <div className="appearance-settings">
      <section className="appearance-preview" aria-label="界面预览">
        <div className="preview-sidebar"><i /><i /><i /></div>
        <div className="preview-content"><span /><strong>保持清晰、安静和自然的阅读节奏</strong><p>正文宽度、字号、间距和对比度会立即生效。</p><div /></div>
      </section>

      <section className="appearance-options">
        <SettingGroup title="主题" description="跟随系统最自然，也可以固定明亮或深色。">
          <SegmentedControl
            value={preferences.theme}
            options={[['system', '跟随系统'], ['light', '明亮'], ['dark', '深色']]}
            onChange={(theme) => update({ theme: theme as AppearancePreferences['theme'] })}
          />
        </SettingGroup>

        <SettingGroup title="文字大小" description="只调整应用正文，不影响系统缩放。">
          <SegmentedControl
            value={String(preferences.fontScale)}
            options={[["0.9", '较小'], ["1", '标准'], ["1.1", '较大'], ["1.2", '最大']]}
            onChange={(fontScale) => update({ fontScale: Number(fontScale) })}
          />
        </SettingGroup>

        <SettingGroup title="阅读宽度" description="较窄更适合长文，较宽更适合代码和表格。">
          <SegmentedControl
            value={preferences.readingWidth}
            options={[['narrow', '专注'], ['standard', '标准'], ['wide', '宽阔']]}
            onChange={(readingWidth) => update({ readingWidth: readingWidth as AppearancePreferences['readingWidth'] })}
          />
        </SettingGroup>

        <SettingGroup title="界面密度" description="舒适模式保留更多呼吸感，紧凑模式显示更多信息。">
          <SegmentedControl
            value={preferences.density}
            options={[['comfortable', '舒适'], ['compact', '紧凑']]}
            onChange={(density) => update({ density: density as AppearancePreferences['density'] })}
          />
        </SettingGroup>

        <ToggleRow label="增强文字对比" description="提高次级文字、边框和焦点状态的可见度。" checked={preferences.highContrast} onChange={(highContrast) => update({ highContrast })} />
        <ToggleRow label="减少动态效果" description="关闭平滑滚动、脉冲和大部分过渡动画。" checked={preferences.reduceMotion} onChange={(reduceMotion) => update({ reduceMotion })} />
      </section>
    </div>
  );
}

function SettingGroup({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <div className="setting-group"><div><strong>{title}</strong><p>{description}</p></div>{children}</div>;
}

function SegmentedControl({ value, options, onChange }: { value: string; options: Array<[string, string]>; onChange: (value: string) => void }) {
  return <div className="segmented-control">{options.map(([key, label]) => <button className={value === key ? 'active' : ''} key={key} onClick={() => onChange(key)}>{label}</button>)}</div>;
}

function ToggleRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="toggle-row"><span><strong>{label}</strong><small>{description}</small></span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><i aria-hidden="true" /></label>;
}

function fromProvider(provider: ModelProviderConfig): ProviderDraft {
  return {
    kind: provider.kind,
    protocol: provider.protocol,
    name: provider.name,
    model: provider.model,
    models: provider.models,
    baseUrl: provider.baseUrl ?? '',
    envKey: provider.envKey ?? '',
    documentationUrl: provider.documentationUrl ?? '',
    capabilities: provider.capabilities,
    enabled: provider.enabled,
    isDefault: provider.isDefault,
    priority: provider.priority,
    timeoutMs: provider.timeoutMs
  };
}

function createCustomDraft(): ProviderDraft {
  return {
    kind: 'openai-compatible' as ProviderKind,
    protocol: 'openai-chat' as ProviderProtocol,
    name: '自定义模型',
    model: 'your-model-id',
    models: ['your-model-id'],
    baseUrl: 'https://example.com/v1',
    envKey: '',
    documentationUrl: '',
    capabilities: emptyCapabilities,
    enabled: true,
    isDefault: false,
    priority: 100,
    timeoutMs: 120_000
  };
}

function capabilityLabel(key: string): string {
  const labels: Record<string, string> = {
    chat: '对话', reasoning: '推理', toolCalling: '工具', streaming: '流式', vision: '视觉', longContext: '长上下文', structuredOutput: '结构化'
  };
  return labels[key] ?? key;
}
