import { describe, expect, it } from 'vitest';
import { HarnessEngine } from '../src/main/chart/harness-engine';
import { resolveComposition } from '../src/main/chart/composition';

const engine = new HarnessEngine();

describe('CHART Harness', () => {
  it('blocks tools outside the selected control level', () => {
    const decision = engine.evaluate({
      id: '1', title: 'Create goal', description: '', tool: 'goal.create', requiresApproval: false, risk: 'low', status: 'pending'
    }, resolveComposition({ control: 'B1' }), 0);
    expect(decision.allowed).toBe(false);
  });

  it('requires approval for high risk exports in B5', () => {
    const decision = engine.evaluate({
      id: '1', title: 'Export', description: '', tool: 'workspace.export', requiresApproval: false, risk: 'high', status: 'pending'
    }, resolveComposition({ control: 'B5' }), 0);
    expect(decision.allowed).toBe(true);
    expect(decision.requiresApproval).toBe(true);
  });
});
