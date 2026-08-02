import { randomUUID } from 'node:crypto';
import type { AppDatabase } from '../db/database';
import type { SecretStore } from '../security/secrets';
import type {
  ModelProviderCapabilities,
  ModelProviderConfig,
  ProviderHealthStatus,
  ProviderTestResult
} from '../../shared/domain';
import type { ProviderInput } from '../../shared/contracts';
import type { ResolvedProvider } from '../ai/providers/types';
import { createProvider } from '../ai/create-provider';

interface ProviderRow {
  id: string;
  kind: ModelProviderConfig['kind'];
  name: string;
  protocol: ModelProviderConfig['protocol'];
  model: string;
  models_json: string;
  base_url: string | null;
  env_key: string | null;
  documentation_url: string | null;
  capabilities_json: string;
  secret_key_ref: string | null;
  enabled: number;
  is_default: number;
  built_in: number;
  priority: number;
  timeout_ms: number;
  last_test_status: ProviderHealthStatus;
  last_test_at: string | null;
  last_latency_ms: number | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

const defaultCapabilities: ModelProviderCapabilities = {
  chat: true,
  reasoning: false,
  toolCalling: false,
  streaming: false,
  vision: false,
  longContext: false,
  structuredOutput: false
};

export class ProviderService {
  constructor(
    private readonly database: AppDatabase,
    private readonly secrets: SecretStore
  ) {}

  list(): ModelProviderConfig[] {
    const rows = this.database.db.prepare(`
      SELECT * FROM providers
      ORDER BY is_default DESC, enabled DESC, priority ASC, created_at ASC
    `).all() as unknown as ProviderRow[];
    return rows.map((row) => this.map(row));
  }

  save(input: ProviderInput): ModelProviderConfig {
    const timestamp = new Date().toISOString();
    const id = input.id ?? randomUUID();
    const existing = this.database.db.prepare('SELECT * FROM providers WHERE id = ?').get(id) as ProviderRow | undefined;
    const secretRef = existing?.secret_key_ref ?? `provider:${id}:api-key`;

    if (input.apiKey?.trim()) this.secrets.set(secretRef, input.apiKey.trim());
    if (input.isDefault) this.database.db.prepare('UPDATE providers SET is_default = 0').run();

    const models = [...new Set([input.model, ...input.models].filter(Boolean))];
    this.database.db.prepare(`
      INSERT INTO providers (
        id, kind, name, protocol, model, models_json, base_url, env_key,
        documentation_url, capabilities_json, secret_key_ref, enabled,
        is_default, built_in, priority, timeout_ms, last_test_status,
        last_test_at, last_latency_ms, last_error, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        kind = excluded.kind,
        name = excluded.name,
        protocol = excluded.protocol,
        model = excluded.model,
        models_json = excluded.models_json,
        base_url = excluded.base_url,
        env_key = excluded.env_key,
        documentation_url = excluded.documentation_url,
        capabilities_json = excluded.capabilities_json,
        secret_key_ref = excluded.secret_key_ref,
        enabled = excluded.enabled,
        is_default = excluded.is_default,
        priority = excluded.priority,
        timeout_ms = excluded.timeout_ms,
        updated_at = excluded.updated_at
    `).run(
      id,
      input.kind,
      input.name,
      input.protocol,
      input.model,
      JSON.stringify(models),
      input.baseUrl || null,
      input.envKey || null,
      input.documentationUrl || null,
      JSON.stringify(input.capabilities),
      input.kind === 'mock' ? null : secretRef,
      input.enabled ? 1 : 0,
      input.isDefault ? 1 : (existing?.is_default ?? 0),
      existing?.built_in ?? 0,
      input.priority,
      input.timeoutMs,
      existing?.last_test_status ?? 'untested',
      existing?.last_test_at ?? null,
      existing?.last_latency_ms ?? null,
      existing?.last_error ?? null,
      existing?.created_at ?? timestamp,
      timestamp
    );

    return this.get(id);
  }

  remove(id: string): void {
    const row = this.database.db.prepare('SELECT * FROM providers WHERE id = ?').get(id) as ProviderRow | undefined;
    if (!row) return;
    if (row.secret_key_ref) this.secrets.delete(row.secret_key_ref);
    if (row.built_in) {
      this.database.db.prepare(`
        UPDATE providers
        SET enabled = 0, is_default = 0, secret_key_ref = NULL, updated_at = ?
        WHERE id = ?
      `).run(new Date().toISOString(), id);
      this.ensureDefault();
      return;
    }
    this.database.db.prepare('DELETE FROM providers WHERE id = ?').run(id);
    this.ensureDefault();
  }

  get(id: string): ModelProviderConfig {
    const row = this.database.db.prepare('SELECT * FROM providers WHERE id = ?').get(id) as ProviderRow | undefined;
    if (!row) throw new Error('模型供应商不存在。');
    return this.map(row);
  }

  getCandidates(): ResolvedProvider[] {
    const rows = this.database.db.prepare(`
      SELECT * FROM providers WHERE enabled = 1
      ORDER BY is_default DESC, priority ASC, updated_at DESC
    `).all() as unknown as ProviderRow[];
    return rows.map((row) => ({ config: this.map(row), apiKey: this.resolveApiKey(row) }));
  }

  setDefault(id: string): ModelProviderConfig {
    const provider = this.get(id);
    if (!provider.enabled) throw new Error('请先启用该模型供应商。');
    this.database.transaction(() => {
      this.database.db.prepare('UPDATE providers SET is_default = 0').run();
      this.database.db.prepare('UPDATE providers SET is_default = 1, updated_at = ? WHERE id = ?')
        .run(new Date().toISOString(), id);
    });
    return this.get(id);
  }

  toggle(id: string, enabled: boolean): ModelProviderConfig {
    const provider = this.get(id);
    this.database.db.prepare('UPDATE providers SET enabled = ?, updated_at = ? WHERE id = ?')
      .run(enabled ? 1 : 0, new Date().toISOString(), id);
    if (!enabled && provider.isDefault) this.ensureDefault();
    return this.get(id);
  }

  async test(id: string): Promise<ProviderTestResult> {
    const row = this.database.db.prepare('SELECT * FROM providers WHERE id = ?').get(id) as ProviderRow | undefined;
    if (!row) throw new Error('模型供应商不存在。');
    const config = this.map(row);
    const apiKey = this.resolveApiKey(row);
    if (config.kind !== 'mock' && !apiKey) {
      const message = `尚未配置API密钥。可在设置中保存，或设置环境变量 ${config.envKey ?? ''}。`.trim();
      this.recordFailure(id, message);
      return { providerId: id, status: 'failed', latencyMs: 0, model: config.model, message, testedAt: new Date().toISOString() };
    }

    const started = Date.now();
    try {
      const provider = createProvider(config, apiKey);
      const response = await provider.complete({
        model: config.model,
        messages: [
          { role: 'system', content: '你是API健康检查助手。' },
          { role: 'user', content: '只回复：OK' }
        ],
        maxTokens: 16,
        temperature: 0,
        signal: AbortSignal.timeout(Math.min(config.timeoutMs, 45_000))
      });
      const latencyMs = Date.now() - started;
      this.recordSuccess(id, latencyMs);
      return {
        providerId: id,
        status: 'healthy',
        latencyMs,
        model: config.model,
        message: response.text.trim().slice(0, 80) || '连接成功',
        testedAt: new Date().toISOString()
      };
    } catch (error) {
      const latencyMs = Date.now() - started;
      const message = error instanceof Error ? error.message : String(error);
      this.recordFailure(id, message, latencyMs);
      return { providerId: id, status: 'failed', latencyMs, model: config.model, message, testedAt: new Date().toISOString() };
    }
  }

  recordSuccess(id: string, latencyMs: number): void {
    this.database.db.prepare(`
      UPDATE providers
      SET last_test_status = 'healthy', last_test_at = ?, last_latency_ms = ?, last_error = NULL
      WHERE id = ?
    `).run(new Date().toISOString(), latencyMs, id);
  }

  recordFailure(id: string, message: string, latencyMs?: number): void {
    this.database.db.prepare(`
      UPDATE providers
      SET last_test_status = 'failed', last_test_at = ?, last_latency_ms = ?, last_error = ?
      WHERE id = ?
    `).run(new Date().toISOString(), latencyMs ?? null, message.slice(0, 1200), id);
  }

  private resolveApiKey(row: ProviderRow): string | undefined {
    if (row.kind === 'mock') return undefined;
    const stored = row.secret_key_ref ? this.secrets.get(row.secret_key_ref) : undefined;
    if (stored) return stored;
    const environment = row.env_key ? process.env[row.env_key]?.trim() : undefined;
    return environment || undefined;
  }

  private map(row: ProviderRow): ModelProviderConfig {
    const stored = Boolean(row.secret_key_ref && this.secrets.get(row.secret_key_ref));
    const environment = Boolean(row.env_key && process.env[row.env_key]?.trim());
    return {
      id: row.id,
      kind: row.kind,
      name: row.name,
      protocol: row.protocol,
      model: row.model,
      models: parseArray(row.models_json, [row.model]),
      baseUrl: row.base_url ?? undefined,
      envKey: row.env_key ?? undefined,
      documentationUrl: row.documentation_url ?? undefined,
      capabilities: parseCapabilities(row.capabilities_json),
      apiKeyStored: stored || environment,
      apiKeySource: row.kind === 'mock' ? 'not-required' : stored ? 'secure-storage' : environment ? 'environment' : 'none',
      enabled: Boolean(row.enabled),
      isDefault: Boolean(row.is_default),
      builtIn: Boolean(row.built_in),
      priority: row.priority,
      timeoutMs: row.timeout_ms,
      lastTestStatus: row.last_test_status ?? 'untested',
      lastTestAt: row.last_test_at ?? undefined,
      lastLatencyMs: row.last_latency_ms ?? undefined,
      lastError: row.last_error ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private ensureDefault(): void {
    const current = this.database.db.prepare('SELECT id FROM providers WHERE enabled = 1 AND is_default = 1 LIMIT 1').get();
    if (current) return;
    const fallback = this.database.db.prepare(`
      SELECT id FROM providers WHERE enabled = 1
      ORDER BY CASE WHEN id = 'provider-deepseek' THEN 0 WHEN kind = 'mock' THEN 2 ELSE 1 END, priority ASC
      LIMIT 1
    `).get() as { id: string } | undefined;
    if (fallback) this.database.db.prepare('UPDATE providers SET is_default = CASE WHEN id = ? THEN 1 ELSE 0 END').run(fallback.id);
  }
}

function parseArray(raw: string, fallback: string[]): string[] {
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : fallback;
  } catch {
    return fallback;
  }
}

function parseCapabilities(raw: string): ModelProviderCapabilities {
  try {
    return { ...defaultCapabilities, ...(JSON.parse(raw) as Partial<ModelProviderCapabilities>) };
  } catch {
    return defaultCapabilities;
  }
}
