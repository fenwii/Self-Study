import { DatabaseSync } from 'node:sqlite';
import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { PROVIDER_PRESETS } from '../ai/provider-catalog';
import type { BackupEntry, MaintenanceSnapshot } from '../../shared/domain';

const now = () => new Date().toISOString();
const SCHEMA_VERSION = 10;

export class AppDatabase {
  readonly db: DatabaseSync;
  readonly filePath: string;

  constructor(databasePath?: string) {
    this.filePath = databasePath ?? path.join(app.getPath('userData'), 'self-study.db');
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    this.applyPendingRestore();
    this.db = new DatabaseSync(this.filePath);
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA synchronous = NORMAL;');
    this.migrate();
    this.seed();
    this.createBackup('daily');
  }

  stageRestore(backupName: string): void {
    if (this.filePath === ':memory:') throw new Error('内存数据库不支持恢复。');
    const backup = this.listBackups().find((item) => item.name === backupName);
    if (!backup) throw new Error('备份不存在或已过期。');
    const backupDirectory = path.resolve(path.dirname(this.filePath), 'backups');
    const backupPath = path.resolve(backupDirectory, backup.name);
    if (!backupPath.startsWith(`${backupDirectory}${path.sep}`)) throw new Error('非法备份路径。');
    this.assertDatabaseIntegrity(backupPath);
    this.createBackup('manual');
    fs.writeFileSync(`${this.filePath}.restore-pending.json`, JSON.stringify({ backupPath, stagedAt: now() }), { mode: 0o600 });
  }

  createBackup(kind: 'daily' | 'manual' = 'manual'): MaintenanceSnapshot {
    if (this.filePath === ':memory:') return this.maintenanceSnapshot();
    const timestamp = new Date();
    const date = timestamp.toISOString().slice(0, 10);
    const compact = timestamp.toISOString().replace(/[-:]/gu, '').replace(/\.\d{3}Z$/u, 'Z');
    const backupDirectory = path.join(path.dirname(this.filePath), 'backups');
    const fileName = kind === 'daily' ? `self-study-daily-${date}.db` : `self-study-manual-${compact}.db`;
    const backupPath = path.join(backupDirectory, fileName);
    if (!fs.existsSync(backupPath)) {
      fs.mkdirSync(backupDirectory, { recursive: true });
      const escapedPath = backupPath.replaceAll("'", "''");
      this.db.exec(`VACUUM INTO '${escapedPath}'`);
    }
    this.pruneBackups(backupDirectory);
    return this.maintenanceSnapshot();
  }

  maintenanceSnapshot(): MaintenanceSnapshot {
    const integrityRows = this.db.prepare('PRAGMA integrity_check').all() as Array<{ integrity_check?: string }>;
    const integrityMessages = integrityRows.map((row) => row.integrity_check ?? '').filter(Boolean);
    const integrityOk = integrityMessages.length === 1 && integrityMessages[0] === 'ok';
    const tables = ['goals', 'goal_conversations', 'messages', 'tasks', 'knowledge_nodes', 'misconceptions', 'review_items', 'habit_recipes', 'habit_checkins', 'learning_contracts', 'weekly_learning_reviews', 'learning_resources', 'assessments', 'artifacts', 'evidence', 'agent_runs'];
    const tableCounts: Record<string, number> = {};
    for (const table of tables) {
      const row = this.db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number };
      tableCounts[table] = Number(row.count);
    }
    const backups = this.listBackups();
    const schemaRow = this.db.prepare('SELECT MAX(version) AS version FROM schema_migrations').get() as { version?: number };
    return {
      schemaVersion: Number(schemaRow.version ?? SCHEMA_VERSION),
      databaseSizeBytes: this.filePath === ':memory:' || !fs.existsSync(this.filePath) ? 0 : fs.statSync(this.filePath).size,
      integrity: integrityOk ? 'ok' : 'warning',
      integrityMessage: integrityOk ? '数据库完整性检查通过。' : integrityMessages.join('；') || '数据库完整性检查返回未知结果。',
      backupCount: backups.length,
      lastBackupAt: backups[0]?.createdAt,
      backups,
      tableCounts,
      generatedAt: now()
    };
  }

  private applyPendingRestore(): void {
    if (this.filePath === ':memory:') return;
    const markerPath = `${this.filePath}.restore-pending.json`;
    if (!fs.existsSync(markerPath)) return;
    const backupDirectory = path.resolve(path.dirname(this.filePath), 'backups');
    const marker = JSON.parse(fs.readFileSync(markerPath, 'utf8')) as { backupPath?: string };
    const backupPath = marker.backupPath ? path.resolve(marker.backupPath) : '';
    if (!backupPath.startsWith(`${backupDirectory}${path.sep}`) || !fs.existsSync(backupPath)) {
      fs.rmSync(markerPath, { force: true });
      throw new Error('待恢复备份无效。');
    }
    this.assertDatabaseIntegrity(backupPath);
    const temporaryPath = `${this.filePath}.restore.tmp`;
    const previousPath = `${this.filePath}.restore.previous`;
    fs.copyFileSync(backupPath, temporaryPath);
    try {
      fs.rmSync(`${this.filePath}-wal`, { force: true });
      fs.rmSync(`${this.filePath}-shm`, { force: true });
      if (fs.existsSync(this.filePath)) fs.renameSync(this.filePath, previousPath);
      fs.renameSync(temporaryPath, this.filePath);
      fs.rmSync(previousPath, { force: true });
      fs.rmSync(markerPath, { force: true });
    } catch (error) {
      fs.rmSync(temporaryPath, { force: true });
      if (!fs.existsSync(this.filePath) && fs.existsSync(previousPath)) fs.renameSync(previousPath, this.filePath);
      throw error;
    }
  }

  private assertDatabaseIntegrity(databasePath: string): void {
    const candidate = new DatabaseSync(databasePath, { readOnly: true });
    try {
      const rows = candidate.prepare('PRAGMA integrity_check').all() as Array<{ integrity_check?: string }>;
      if (rows.length !== 1 || rows[0]?.integrity_check !== 'ok') throw new Error('备份数据库完整性检查失败。');
    } finally {
      candidate.close();
    }
  }

  private listBackups(): BackupEntry[] {
    if (this.filePath === ':memory:') return [];
    const backupDirectory = path.join(path.dirname(this.filePath), 'backups');
    if (!fs.existsSync(backupDirectory)) return [];
    return fs.readdirSync(backupDirectory)
      .filter((name) => /^self-study-(daily-\d{4}-\d{2}-\d{2}|manual-\d{8}T\d{6}Z)\.db$/u.test(name))
      .map((name) => {
        const stat = fs.statSync(path.join(backupDirectory, name));
        return { name, sizeBytes: stat.size, createdAt: stat.mtime.toISOString(), kind: name.includes('-manual-') ? 'manual' as const : 'daily' as const };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  private pruneBackups(backupDirectory: string): void {
    const entries = this.listBackups();
    const daily = entries.filter((item) => item.kind === 'daily');
    const manual = entries.filter((item) => item.kind === 'manual');
    for (const expired of [...daily.slice(14), ...manual.slice(20)]) fs.rmSync(path.join(backupDirectory, expired.name), { force: true });
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS goals (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        desired_outcome TEXT NOT NULL DEFAULT '',
        current_level INTEGER NOT NULL DEFAULT 1,
        target_level INTEGER NOT NULL DEFAULT 4,
        status TEXT NOT NULL DEFAULT 'active',
        target_date TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'todo',
        stage TEXT NOT NULL DEFAULT 'understanding',
        priority INTEGER NOT NULL DEFAULT 50,
        due_at TEXT,
        estimated_minutes INTEGER NOT NULL DEFAULT 25,
        created_at TEXT NOT NULL,
        completed_at TEXT,
        archived INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS knowledge_nodes (
        id TEXT PRIMARY KEY,
        goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        summary TEXT NOT NULL DEFAULT '',
        stage TEXT NOT NULL DEFAULT 'understanding',
        mastery REAL NOT NULL DEFAULT 0,
        confidence REAL NOT NULL DEFAULT 0,
        prerequisites_json TEXT NOT NULL DEFAULT '[]',
        misconceptions_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS knowledge_edges (
        id TEXT PRIMARY KEY,
        goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
        source_node_id TEXT NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
        target_node_id TEXT NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        weight REAL NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        UNIQUE(source_node_id, target_node_id, type)
      );

      CREATE TABLE IF NOT EXISTS misconceptions (
        id TEXT PRIMARY KEY,
        goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
        knowledge_node_id TEXT REFERENCES knowledge_nodes(id) ON DELETE SET NULL,
        statement TEXT NOT NULL,
        correction TEXT NOT NULL DEFAULT '',
        evidence_needed TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'open',
        recurrence_count INTEGER NOT NULL DEFAULT 0,
        next_check_at TEXT,
        resolved_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS review_items (
        id TEXT PRIMARY KEY,
        goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
        knowledge_node_id TEXT REFERENCES knowledge_nodes(id) ON DELETE SET NULL,
        prompt TEXT NOT NULL,
        answer TEXT NOT NULL DEFAULT '',
        due_at TEXT NOT NULL,
        interval_days REAL NOT NULL DEFAULT 0,
        ease_factor REAL NOT NULL DEFAULT 2.5,
        repetitions INTEGER NOT NULL DEFAULT 0,
        lapses INTEGER NOT NULL DEFAULT 0,
        last_rating TEXT,
        last_reviewed_at TEXT,
        suspended INTEGER NOT NULL DEFAULT 0,
        suspended_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS learning_sessions (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        goal_id TEXT REFERENCES goals(id) ON DELETE SET NULL,
        mode TEXT NOT NULL,
        objective TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        planned_minutes INTEGER NOT NULL DEFAULT 25,
        actual_minutes INTEGER NOT NULL DEFAULT 0,
        summary TEXT NOT NULL DEFAULT '',
        started_at TEXT NOT NULL,
        ended_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS artifacts (
        id TEXT PRIMARY KEY,
        goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
        task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
        kind TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        content TEXT NOT NULL DEFAULT '',
        file_path TEXT,
        status TEXT NOT NULL DEFAULT 'draft',
        rubric_json TEXT NOT NULL DEFAULT '[]',
        provenance_json TEXT NOT NULL DEFAULT '{}',
        archived_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS learning_paths (
        id TEXT PRIMARY KEY,
        goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'draft',
        version INTEGER NOT NULL DEFAULT 1,
        estimated_hours REAL NOT NULL DEFAULT 0,
        strategy TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS path_milestones (
        id TEXT PRIMARY KEY,
        path_id TEXT NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
        goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
        order_index INTEGER NOT NULL,
        title TEXT NOT NULL,
        outcome TEXT NOT NULL DEFAULT '',
        evidence_required_json TEXT NOT NULL DEFAULT '[]',
        estimated_minutes INTEGER NOT NULL DEFAULT 60,
        status TEXT NOT NULL DEFAULT 'locked',
        completed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(path_id, order_index)
      );

      CREATE TABLE IF NOT EXISTS learning_resources (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        goal_id TEXT REFERENCES goals(id) ON DELETE SET NULL,
        title TEXT NOT NULL,
        kind TEXT NOT NULL,
        source_path TEXT,
        source_url TEXT,
        checksum TEXT NOT NULL,
        byte_size INTEGER NOT NULL DEFAULT 0,
        mime_type TEXT NOT NULL DEFAULT 'text/plain',
        summary TEXT NOT NULL DEFAULT '',
        tags_json TEXT NOT NULL DEFAULT '[]',
        chunk_count INTEGER NOT NULL DEFAULT 0,
        archived INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(workspace_id, checksum)
      );

      CREATE TABLE IF NOT EXISTS resource_chunks (
        id TEXT PRIMARY KEY,
        resource_id TEXT NOT NULL REFERENCES learning_resources(id) ON DELETE CASCADE,
        chunk_index INTEGER NOT NULL,
        content TEXT NOT NULL,
        normalized_text TEXT NOT NULL,
        token_estimate INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        UNIQUE(resource_id, chunk_index)
      );

      CREATE TABLE IF NOT EXISTS assessments (
        id TEXT PRIMARY KEY,
        goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        kind TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'ready',
        instructions TEXT NOT NULL DEFAULT '',
        questions_json TEXT NOT NULL DEFAULT '[]',
        pass_score REAL NOT NULL DEFAULT 0.7,
        archived_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS assessment_attempts (
        id TEXT PRIMARY KEY,
        assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
        goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
        answer TEXT NOT NULL,
        score REAL NOT NULL DEFAULT 0,
        feedback TEXT NOT NULL DEFAULT '',
        independence REAL NOT NULL DEFAULT 1,
        submitted_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS artifact_evaluations (
        id TEXT PRIMARY KEY,
        artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
        goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
        score REAL NOT NULL DEFAULT 0,
        passed INTEGER NOT NULL DEFAULT 0,
        criterion_scores_json TEXT NOT NULL DEFAULT '[]',
        summary TEXT NOT NULL DEFAULT '',
        evaluator TEXT NOT NULL DEFAULT 'automated',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS evidence (
        id TEXT PRIMARY KEY,
        goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
        task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
        kind TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        independence REAL NOT NULL DEFAULT 0,
        retention REAL NOT NULL DEFAULT 0,
        transfer REAL NOT NULL DEFAULT 0,
        evaluator TEXT NOT NULL DEFAULT 'ai',
        provenance_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS reflections (
        id TEXT PRIMARY KEY,
        goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        what_worked TEXT NOT NULL DEFAULT '',
        what_failed TEXT NOT NULL DEFAULT '',
        next_action TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS goal_conversations (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        goal_id TEXT REFERENCES goals(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        pinned INTEGER NOT NULL DEFAULT 0,
        draft_text TEXT NOT NULL DEFAULT '',
        draft_updated_at TEXT,
        last_opened_at TEXT,
        last_message_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(workspace_id, goal_id)
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        goal_id TEXT REFERENCES goals(id) ON DELETE CASCADE,
        conversation_id TEXT REFERENCES goal_conversations(id) ON DELETE SET NULL,
        run_id TEXT,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS agent_runs (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        goal_id TEXT REFERENCES goals(id) ON DELETE SET NULL,
        conversation_id TEXT REFERENCES goal_conversations(id) ON DELETE SET NULL,
        status TEXT NOT NULL,
        user_input TEXT NOT NULL,
        intent TEXT NOT NULL,
        composition_json TEXT NOT NULL,
        plan_json TEXT NOT NULL,
        current_step INTEGER NOT NULL DEFAULT 0,
        cost_cny REAL NOT NULL DEFAULT 0,
        error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS approvals (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
        step_id TEXT NOT NULL,
        reason TEXT NOT NULL,
        risk TEXT NOT NULL,
        requested_at TEXT NOT NULL,
        resolved_at TEXT,
        decision TEXT
      );

      CREATE TABLE IF NOT EXISTS traces (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
        sequence INTEGER NOT NULL,
        category TEXT NOT NULL,
        action TEXT NOT NULL,
        input_json TEXT NOT NULL DEFAULT '{}',
        output_json TEXT NOT NULL DEFAULT '{}',
        status TEXT NOT NULL,
        duration_ms INTEGER NOT NULL DEFAULT 0,
        cost_cny REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS checkpoints (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
        step_index INTEGER NOT NULL,
        state_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS model_usage (
        id TEXT PRIMARY KEY,
        run_id TEXT REFERENCES agent_runs(id) ON DELETE SET NULL,
        provider_id TEXT NOT NULL,
        model TEXT NOT NULL,
        purpose TEXT NOT NULL,
        input_tokens INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        cost_cny REAL NOT NULL DEFAULT 0,
        latency_ms INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS habit_recipes (
        id TEXT PRIMARY KEY,
        goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        anchor TEXT NOT NULL,
        tiny_behavior TEXT NOT NULL,
        expansion_behavior TEXT NOT NULL DEFAULT '',
        celebration TEXT NOT NULL,
        frequency TEXT NOT NULL DEFAULT 'daily',
        custom_days_json TEXT NOT NULL DEFAULT '[]',
        minimum_seconds INTEGER NOT NULL DEFAULT 30,
        preferred_minutes INTEGER NOT NULL DEFAULT 10,
        status TEXT NOT NULL DEFAULT 'active',
        streak INTEGER NOT NULL DEFAULT 0,
        best_streak INTEGER NOT NULL DEFAULT 0,
        last_check_in_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS habit_checkins (
        id TEXT PRIMARY KEY,
        habit_id TEXT NOT NULL REFERENCES habit_recipes(id) ON DELETE CASCADE,
        goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
        result TEXT NOT NULL,
        motivation INTEGER NOT NULL,
        ability INTEGER NOT NULL,
        prompt_seen INTEGER NOT NULL DEFAULT 1,
        celebrated INTEGER NOT NULL DEFAULT 0,
        duration_seconds INTEGER NOT NULL DEFAULT 0,
        note TEXT NOT NULL DEFAULT '',
        local_date TEXT NOT NULL,
        timezone_offset_minutes INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS learning_contracts (
        id TEXT PRIMARY KEY,
        goal_id TEXT NOT NULL UNIQUE REFERENCES goals(id) ON DELETE CASCADE,
        learner_name TEXT NOT NULL,
        why_now TEXT NOT NULL,
        success_definition TEXT NOT NULL,
        weekly_minutes INTEGER NOT NULL DEFAULT 120,
        session_minutes INTEGER NOT NULL DEFAULT 25,
        preferred_days_json TEXT NOT NULL DEFAULT '[1,2,3,4,5]',
        preferred_time TEXT NOT NULL DEFAULT '',
        coaching_style TEXT NOT NULL DEFAULT 'balanced',
        feedback_preference TEXT NOT NULL DEFAULT 'evidence-first',
        challenge_level INTEGER NOT NULL DEFAULT 3,
        autonomy_target REAL NOT NULL DEFAULT 0.8,
        minimum_commitment TEXT NOT NULL,
        review_cadence TEXT NOT NULL DEFAULT 'weekly',
        status TEXT NOT NULL DEFAULT 'active',
        version INTEGER NOT NULL DEFAULT 1,
        agreed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS weekly_learning_reviews (
        id TEXT PRIMARY KEY,
        goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
        period_start TEXT NOT NULL,
        period_end TEXT NOT NULL,
        planned_sessions INTEGER NOT NULL DEFAULT 0,
        completed_sessions INTEGER NOT NULL DEFAULT 0,
        tiny_actions_completed INTEGER NOT NULL DEFAULT 0,
        evidence_created INTEGER NOT NULL DEFAULT 0,
        reflection TEXT NOT NULL DEFAULT '',
        coach_summary TEXT NOT NULL,
        next_focus TEXT NOT NULL,
        behavior_adjustment TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(goal_id, period_start, period_end)
      );

      CREATE TABLE IF NOT EXISTS providers (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        name TEXT NOT NULL,
        protocol TEXT NOT NULL DEFAULT 'openai-chat',
        model TEXT NOT NULL,
        models_json TEXT NOT NULL DEFAULT '[]',
        base_url TEXT,
        env_key TEXT,
        documentation_url TEXT,
        capabilities_json TEXT NOT NULL DEFAULT '{}',
        secret_key_ref TEXT,
        enabled INTEGER NOT NULL DEFAULT 1,
        is_default INTEGER NOT NULL DEFAULT 0,
        built_in INTEGER NOT NULL DEFAULT 0,
        priority INTEGER NOT NULL DEFAULT 100,
        timeout_ms INTEGER NOT NULL DEFAULT 120000,
        last_test_status TEXT NOT NULL DEFAULT 'untested',
        last_test_at TEXT,
        last_latency_ms INTEGER,
        last_error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_goals_workspace ON goals(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_goal ON tasks(goal_id, status, priority);
      CREATE INDEX IF NOT EXISTS idx_knowledge_goal ON knowledge_nodes(goal_id);
      CREATE INDEX IF NOT EXISTS idx_edges_goal ON knowledge_edges(goal_id);
      CREATE INDEX IF NOT EXISTS idx_misconceptions_goal ON misconceptions(goal_id, status);
      CREATE INDEX IF NOT EXISTS idx_reviews_due ON review_items(goal_id, due_at, suspended);
      CREATE INDEX IF NOT EXISTS idx_sessions_workspace ON learning_sessions(workspace_id, started_at);
      CREATE INDEX IF NOT EXISTS idx_artifacts_goal ON artifacts(goal_id, status);
      CREATE INDEX IF NOT EXISTS idx_paths_goal ON learning_paths(goal_id, status);
      CREATE INDEX IF NOT EXISTS idx_milestones_path ON path_milestones(path_id, order_index);
      CREATE INDEX IF NOT EXISTS idx_resources_workspace ON learning_resources(workspace_id, updated_at);
      CREATE INDEX IF NOT EXISTS idx_resources_goal ON learning_resources(goal_id, updated_at);
      CREATE INDEX IF NOT EXISTS idx_resource_chunks_resource ON resource_chunks(resource_id, chunk_index);
      CREATE INDEX IF NOT EXISTS idx_assessments_goal ON assessments(goal_id, status);
      CREATE INDEX IF NOT EXISTS idx_assessment_attempts_assessment ON assessment_attempts(assessment_id, submitted_at);
      CREATE INDEX IF NOT EXISTS idx_artifact_evaluations_artifact ON artifact_evaluations(artifact_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_conversations_workspace ON goal_conversations(workspace_id, updated_at);
      CREATE INDEX IF NOT EXISTS idx_conversations_goal ON goal_conversations(goal_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_general_unique ON goal_conversations(workspace_id) WHERE goal_id IS NULL;
      CREATE INDEX IF NOT EXISTS idx_messages_workspace ON messages(workspace_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_runs_workspace ON agent_runs(workspace_id, updated_at);
      CREATE INDEX IF NOT EXISTS idx_traces_run ON traces(run_id, sequence);
      CREATE INDEX IF NOT EXISTS idx_model_usage_created ON model_usage(created_at);
      CREATE INDEX IF NOT EXISTS idx_habits_goal_status ON habit_recipes(goal_id, status, updated_at);
      CREATE INDEX IF NOT EXISTS idx_habit_checkins_habit ON habit_checkins(habit_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_habit_checkins_goal ON habit_checkins(goal_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_contracts_goal_status ON learning_contracts(goal_id, status, updated_at);
      CREATE INDEX IF NOT EXISTS idx_weekly_reviews_goal_period ON weekly_learning_reviews(goal_id, period_end DESC);
    `);

    this.ensureColumn('tasks', 'completed_at', 'TEXT');
    this.ensureColumn('tasks', 'archived', 'INTEGER NOT NULL DEFAULT 0');
    this.ensureColumn('misconceptions', 'resolved_at', 'TEXT');
    this.ensureColumn('review_items', 'suspended_at', 'TEXT');
    this.ensureColumn('habit_checkins', 'local_date', "TEXT NOT NULL DEFAULT ''");
    this.ensureColumn('habit_checkins', 'timezone_offset_minutes', 'INTEGER NOT NULL DEFAULT 0');
    this.ensureColumn('learning_resources', 'archived', 'INTEGER NOT NULL DEFAULT 0');
    this.ensureColumn('assessments', 'archived_at', 'TEXT');
    this.ensureColumn('artifacts', 'archived_at', 'TEXT');
    this.ensureColumn('evidence', 'provenance_json', "TEXT NOT NULL DEFAULT '{}'");
    this.ensureColumn('goal_conversations', 'pinned', 'INTEGER NOT NULL DEFAULT 0');
    this.ensureColumn('goal_conversations', 'draft_text', "TEXT NOT NULL DEFAULT ''");
    this.ensureColumn('goal_conversations', 'draft_updated_at', 'TEXT');
    this.ensureColumn('goal_conversations', 'last_opened_at', 'TEXT');
    this.ensureColumn('messages', 'goal_id', 'TEXT');
    this.ensureColumn('messages', 'conversation_id', 'TEXT');
    this.ensureColumn('agent_runs', 'conversation_id', 'TEXT');
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_conversations_status_pin ON goal_conversations(workspace_id, status, pinned, updated_at);
      CREATE INDEX IF NOT EXISTS idx_tasks_goal_archived ON tasks(goal_id, archived, status, priority);
      CREATE INDEX IF NOT EXISTS idx_resources_archived ON learning_resources(workspace_id, archived, updated_at);
      CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_messages_goal ON messages(goal_id, created_at);
    `);
    this.ensureColumn('providers', 'protocol', "TEXT NOT NULL DEFAULT 'openai-chat'");
    this.ensureColumn('providers', 'models_json', "TEXT NOT NULL DEFAULT '[]'");
    this.ensureColumn('providers', 'env_key', 'TEXT');
    this.ensureColumn('providers', 'documentation_url', 'TEXT');
    this.ensureColumn('providers', 'capabilities_json', "TEXT NOT NULL DEFAULT '{}'");
    this.ensureColumn('providers', 'is_default', 'INTEGER NOT NULL DEFAULT 0');
    this.ensureColumn('providers', 'built_in', 'INTEGER NOT NULL DEFAULT 0');
    this.ensureColumn('providers', 'priority', 'INTEGER NOT NULL DEFAULT 100');
    this.ensureColumn('providers', 'timeout_ms', 'INTEGER NOT NULL DEFAULT 120000');
    this.ensureColumn('providers', 'last_test_status', "TEXT NOT NULL DEFAULT 'untested'");
    this.ensureColumn('providers', 'last_test_at', 'TEXT');
    this.ensureColumn('providers', 'last_latency_ms', 'INTEGER');
    this.ensureColumn('providers', 'last_error', 'TEXT');

    this.db.exec(`
      UPDATE providers SET protocol = 'anthropic-messages' WHERE kind = 'anthropic';
      UPDATE providers SET protocol = 'gemini-native' WHERE kind = 'gemini';
      UPDATE providers SET protocol = 'openai-responses' WHERE kind = 'openai';
      UPDATE providers SET protocol = 'mock' WHERE kind = 'mock';

      UPDATE tasks SET completed_at = updated_at WHERE status = 'done' AND completed_at IS NULL;
      UPDATE tasks SET archived = 1 WHERE status = 'archived';
      UPDATE misconceptions SET resolved_at = updated_at WHERE status = 'resolved' AND resolved_at IS NULL;
      UPDATE review_items SET suspended_at = updated_at WHERE suspended = 1 AND suspended_at IS NULL;
      UPDATE habit_checkins SET local_date = substr(created_at, 1, 10) WHERE local_date = '' OR local_date IS NULL;
      UPDATE learning_resources SET archived = 0 WHERE archived IS NULL;
    `);

    this.backfillGoalConversations();
    this.db.prepare(`
      INSERT OR IGNORE INTO settings (key, value_json, updated_at)
      VALUES ('appearance', ?, ?)
    `).run(JSON.stringify({
      theme: 'system',
      fontScale: 1,
      density: 'comfortable',
      readingWidth: 'standard',
      reduceMotion: false,
      highContrast: false
    }), now());
    this.db.prepare('INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(SCHEMA_VERSION, now());
  }

  private backfillGoalConversations(): void {
    const timestamp = now();
    const workspaces = this.db.prepare('SELECT id, name FROM workspaces').all() as Array<{ id: string; name: string }>;
    for (const workspace of workspaces) {
      const general = this.db.prepare('SELECT id FROM goal_conversations WHERE workspace_id = ? AND goal_id IS NULL LIMIT 1').get(workspace.id) as { id: string } | undefined;
      const generalId = general?.id ?? randomUUID();
      if (!general) this.db.prepare(`INSERT INTO goal_conversations (id, workspace_id, goal_id, title, status, created_at, updated_at) VALUES (?, ?, NULL, ?, 'active', ?, ?)`)
        .run(generalId, workspace.id, '新目标与临时对话', timestamp, timestamp);
      const goals = this.db.prepare('SELECT id, title FROM goals WHERE workspace_id = ?').all(workspace.id) as Array<{ id: string; title: string }>;
      for (const goal of goals) {
        const existing = this.db.prepare('SELECT id FROM goal_conversations WHERE goal_id = ? LIMIT 1').get(goal.id) as { id: string } | undefined;
        if (!existing) this.db.prepare(`INSERT INTO goal_conversations (id, workspace_id, goal_id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'active', ?, ?)`)
          .run(randomUUID(), workspace.id, goal.id, goal.title, timestamp, timestamp);
      }
    }
    this.db.exec(`
      UPDATE messages
      SET goal_id = COALESCE(goal_id, (SELECT goal_id FROM agent_runs WHERE agent_runs.id = messages.run_id))
      WHERE run_id IS NOT NULL;
      UPDATE messages
      SET conversation_id = COALESCE(
        conversation_id,
        (SELECT id FROM goal_conversations WHERE goal_conversations.goal_id = messages.goal_id LIMIT 1),
        (SELECT id FROM goal_conversations WHERE goal_conversations.workspace_id = messages.workspace_id AND goal_conversations.goal_id IS NULL LIMIT 1)
      );
      UPDATE agent_runs
      SET conversation_id = COALESCE(
        conversation_id,
        (SELECT id FROM goal_conversations WHERE goal_conversations.goal_id = agent_runs.goal_id LIMIT 1),
        (SELECT id FROM goal_conversations WHERE goal_conversations.workspace_id = agent_runs.workspace_id AND goal_conversations.goal_id IS NULL LIMIT 1)
      );
      UPDATE goal_conversations
      SET last_message_at = (SELECT MAX(created_at) FROM messages WHERE messages.conversation_id = goal_conversations.id),
          last_opened_at = COALESCE(last_opened_at, updated_at),
          updated_at = COALESCE((SELECT MAX(created_at) FROM messages WHERE messages.conversation_id = goal_conversations.id), updated_at);
    `);
  }

  private ensureColumn(table: string, column: string, definition: string): void {
    const rows = this.db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (!rows.some((row) => row.name === column)) this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }

  private seed(): void {
    this.seedWorkspace();
    this.seedProviders();
  }

  private seedWorkspace(): void {
    const count = this.db.prepare('SELECT COUNT(*) AS count FROM workspaces').get() as { count: number };
    if (count.count > 0) return;

    const workspaceId = randomUUID();
    const goalId = randomUUID();
    const conversationId = randomUUID();
    const taskId = randomUUID();
    const nodeId = randomUUID();
    const reviewId = randomUUID();
    const timestamp = now();

    this.transaction(() => {
      this.db.prepare(`INSERT INTO workspaces (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`)
        .run(workspaceId, '我的自学空间', '把目标转化为可验证、可保持、可迁移的独立能力。', timestamp, timestamp);

      this.db.prepare(`
        INSERT INTO goals (id, workspace_id, title, description, desired_outcome, current_level, target_level, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        goalId,
        workspaceId,
        '掌握 Self-Study.ai 的使用方法',
        '通过一次真实目标体验演示、降维、知识地图、练习、复习、证据和反思闭环。',
        '能够独立创建长期学习目标，并完成首个可验证作品。',
        1,
        3,
        'active',
        timestamp,
        timestamp
      );

      this.db.prepare(`INSERT INTO goal_conversations (id, workspace_id, goal_id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'active', ?, ?)`)
        .run(conversationId, workspaceId, goalId, '掌握 Self-Study.ai 的使用方法', timestamp, timestamp);

      this.db.prepare(`
        INSERT INTO tasks (id, goal_id, title, description, status, stage, priority, estimated_minutes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(taskId, goalId, '告诉智能体你真正想学会什么', '直接用自然语言描述目标、时间、已有基础和想完成的作品。', 'todo', 'curiosity', 100, 10, timestamp, timestamp);

      this.db.prepare(`
        INSERT INTO knowledge_nodes (id, goal_id, title, summary, stage, mastery, confidence, prerequisites_json, misconceptions_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(nodeId, goalId, '自学闭环', '目标—尝试—反馈—证据—复习—迁移。', 'mapping', 0.35, 0.5, '[]', '[]', timestamp, timestamp);

      this.db.prepare(`
        INSERT INTO review_items (id, goal_id, knowledge_node_id, prompt, answer, due_at, interval_days, ease_factor, repetitions, lapses, suspended, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(reviewId, goalId, nodeId, '不看资料，说出Self-Study.ai学习闭环的六个环节。', '目标、尝试、反馈、证据、复习、迁移。', timestamp, 0, 2.5, 0, 0, 0, timestamp, timestamp);

      this.db.prepare(`INSERT INTO messages (id, workspace_id, goal_id, conversation_id, role, content, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(
          randomUUID(),
          workspaceId,
          goalId,
          conversationId,
          'assistant',
          '你好，我是你的长期自学伙伴。\n\n你可以直接说：“我想在三个月内学会 TypeScript，并完成一个 Electron 桌面应用。”\n\n我会理解目标，建立知识地图，安排专注会话和间隔复习，并用真实作品验证能力。',
          '{}',
          timestamp
        );
    });
  }

  private seedProviders(): void {
    const timestamp = now();
    const existingDefault = this.db.prepare('SELECT id, kind FROM providers WHERE is_default = 1 LIMIT 1').get() as { id: string; kind: string } | undefined;
    const promoteDeepSeek = !existingDefault || existingDefault.kind === 'mock';

    for (const preset of PROVIDER_PRESETS) {
      const exists = this.db.prepare('SELECT id FROM providers WHERE id = ?').get(preset.id) as { id: string } | undefined;
      if (exists) continue;
      this.db.prepare(`
        INSERT INTO providers (
          id, kind, name, protocol, model, models_json, base_url, env_key,
          documentation_url, capabilities_json, secret_key_ref, enabled,
          is_default, built_in, priority, timeout_ms, last_test_status,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        preset.id,
        preset.kind,
        preset.name,
        preset.protocol,
        preset.model,
        JSON.stringify(preset.models),
        preset.baseUrl ?? null,
        preset.envKey ?? null,
        preset.documentationUrl ?? null,
        JSON.stringify(preset.capabilities),
        null,
        preset.enabled ? 1 : 0,
        promoteDeepSeek && preset.isDefault ? 1 : 0,
        1,
        preset.priority,
        preset.timeoutMs,
        'untested',
        timestamp,
        timestamp
      );
    }

    if (promoteDeepSeek || !this.db.prepare('SELECT id FROM providers WHERE is_default = 1 LIMIT 1').get()) {
      this.db.prepare("UPDATE providers SET is_default = CASE WHEN id = 'provider-deepseek' THEN 1 ELSE 0 END").run();
    }
  }

  transaction<T>(operation: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = operation();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  close(): void {
    this.db.close();
  }
}
