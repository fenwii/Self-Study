import { describe, expect, it } from 'vitest';
import { resolveComposition } from '../src/main/chart/composition';

 describe('A5+B5+C5+D5 composition', () => {
  it('enables lifelong context, controlled tools, evidence and full traceability', () => {
    const composition = resolveComposition({ agent: 'A5', control: 'B5', adaptation: 'C5', governance: 'D5' });
    expect(composition.chart.context.memoryDepth).toBe('lifelong');
    expect(composition.chart.harness.approvalMode).toBe('risk-based');
    expect(composition.chart.alignment.requireEvidence).toBe(true);
    expect(composition.chart.alignment.antiDependency).toBe(true);
    expect(composition.chart.traceability.level).toBe('full');
    expect(composition.chart.runtime.tools).toContain('goal.create');
    expect(composition.chart.runtime.tools).toContain('review.schedule');
    expect(composition.chart.runtime.tools).toContain('artifact.create');
    expect(composition.chart.runtime.tools).toContain('path.compile');
    expect(composition.chart.runtime.tools).toContain('resource.search');
    expect(composition.chart.runtime.tools).toContain('assessment.create');
    expect(composition.chart.runtime.tools).toContain('artifact.evaluate');
  });

  it('supports lightweight combinations without tool access', () => {
    const composition = resolveComposition({ agent: 'A1', control: 'B1', adaptation: 'C1', governance: 'D1' });
    expect(composition.chart.runtime.tools).toHaveLength(0);
    expect(composition.chart.alignment.requireEvidence).toBe(false);
    expect(composition.chart.traceability.level).toBe('minimal');
  });
});
