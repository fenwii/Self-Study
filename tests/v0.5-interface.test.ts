import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveRunIntent } from '../src/main/agents/run-manager';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('V0.5 minimalist goal workspace and safe rich chat', () => {
  it('treats a message without goal id as a new goal, not an existing active goal', () => {
    expect(resolveRunIntent('请解释状态机')).toBe('create-goal');
    expect(resolveRunIntent('请解释状态机', 'goal-1')).toBe('explain');
  });

  it('configures Markdown, GFM and KaTeX without raw HTML or trusted commands', () => {
    const component = fs.readFileSync(path.join(root, 'src/app/components/MarkdownMessage.tsx'), 'utf8');
    expect(component).toContain('skipHtml');
    expect(component).toContain('remarkGfm');
    expect(component).toContain('remarkMath');
    expect(component).toContain('rehypeKatex');
    expect(component).toContain('trust: false');
    expect(component).not.toContain('rehypeRaw');
  });

  it('ships the exact rich-text dependencies and pending-run goal switch', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as { version: string; dependencies: Record<string, string> };
    const store = fs.readFileSync(path.join(root, 'src/app/store.ts'), 'utf8');
    expect(Number(pkg.version.split('.')[1])).toBeGreaterThanOrEqual(5);
    for (const dependency of ['react-markdown', 'remark-gfm', 'remark-math', 'rehype-katex', 'katex']) {
      expect(pkg.dependencies[dependency]).toBeTruthy();
    }
    expect(store).toContain('pendingNewGoalRunId');
    expect(store).toContain('message.runId === state.pendingNewGoalRunId');
  });
});
