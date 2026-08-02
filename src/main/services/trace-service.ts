import { randomUUID } from 'node:crypto';
import type { AppDatabase } from '../db/database';

export interface TraceInput {
  runId: string;
  category: 'context' | 'harness' | 'alignment' | 'runtime' | 'traceability' | 'model';
  action: string;
  input?: unknown;
  output?: unknown;
  status: 'started' | 'completed' | 'failed' | 'blocked';
  durationMs?: number;
  costCny?: number;
}

export class TraceService {
  constructor(private readonly database: AppDatabase) {}

  append(trace: TraceInput): void {
    const sequence = this.database.db
      .prepare('SELECT COALESCE(MAX(sequence), 0) + 1 AS next FROM traces WHERE run_id = ?')
      .get(trace.runId) as { next: number };

    this.database.db.prepare(`
      INSERT INTO traces (
        id, run_id, sequence, category, action, input_json, output_json,
        status, duration_ms, cost_cny, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      randomUUID(),
      trace.runId,
      sequence.next,
      trace.category,
      trace.action,
      JSON.stringify(trace.input ?? {}),
      JSON.stringify(trace.output ?? {}),
      trace.status,
      trace.durationMs ?? 0,
      trace.costCny ?? 0,
      new Date().toISOString()
    );
  }

  checkpoint(runId: string, stepIndex: number, state: unknown): string {
    const id = randomUUID();
    this.database.db.prepare(`
      INSERT INTO checkpoints (id, run_id, step_index, state_json, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, runId, stepIndex, JSON.stringify(state), new Date().toISOString());
    return id;
  }

  latestCheckpoint(runId: string): { stepIndex: number; state: unknown } | undefined {
    const row = this.database.db.prepare(`
      SELECT step_index, state_json FROM checkpoints
      WHERE run_id = ? ORDER BY created_at DESC LIMIT 1
    `).get(runId) as { step_index: number; state_json: string } | undefined;

    if (!row) return undefined;
    return { stepIndex: row.step_index, state: JSON.parse(row.state_json) };
  }
}
