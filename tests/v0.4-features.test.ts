import { describe, expect, it } from 'vitest';
import { routeIntent } from '../src/main/agents/intent-router';
import { createPlan } from '../src/main/agents/planner';
import { resolveComposition } from '../src/main/chart/composition';
import { selectSkills } from '../src/main/skills/catalog';

 describe('V0.4 one-stop learning lifecycle', () => {
  it('routes natural language to path, library, assessment and artifact acceptance', () => {
    expect(routeIntent('为这个目标编译一条龙学习路径')).toBe('compile-path');
    expect(routeIntent('从资料库中查找状态机相关内容')).toBe('search-library');
    expect(routeIntent('导入我的Markdown资料')).toBe('import-resource');
    expect(routeIntent('考考我是否真正掌握')).toBe('take-assessment');
    expect(routeIntent('验收我的Electron作品')).toBe('evaluate-artifact');
  });

  it('exposes the V0.4 tools in A5+B5+C5+D5', () => {
    const tools = resolveComposition({ agent: 'A5', control: 'B5', adaptation: 'C5', governance: 'D5' }).chart.runtime.tools;
    for (const tool of ['path.compile', 'resource.search', 'assessment.create', 'assessment.submit', 'artifact.evaluate']) {
      expect(tools).toContain(tool);
    }
  });

  it('selects dedicated skills for path, library and authentic assessment', () => {
    expect(selectSkills('compile-path', 'A5').map((item) => item.id)).toContain('skill-path-compiler');
    expect(selectSkills('search-library', 'A5').map((item) => item.id)).toContain('skill-local-library');
    expect(selectSkills('take-assessment', 'A5').map((item) => item.id)).toContain('skill-authentic-assessment');
  });

  it('treats common answer phrases as assessment submission', () => {
    const plan = createPlan('take-assessment', '这是我的答案：第一题……', true);
    expect(plan.steps.some((item) => item.tool === 'assessment.submit')).toBe(true);
    expect(plan.steps.some((item) => item.tool === 'assessment.create')).toBe(false);
  });
});
