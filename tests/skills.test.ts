import { describe, expect, it } from 'vitest';
import { selectSkills } from '../src/main/skills/catalog';

describe('agent skill routing', () => {
  it('selects the three-method skill for explanation', () => {
    expect(selectSkills('explain', 'A1').map((item) => item.id)).toContain('skill-three-methods');
  });

  it('does not expose research skill below A4', () => {
    expect(selectSkills('show-knowledge', 'A3').map((item) => item.id)).not.toContain('skill-research-lens');
  });

  it('selects V0.4 lifecycle skills', () => {
    expect(selectSkills('compile-path', 'A5').map((item) => item.id)).toContain('skill-path-compiler');
    expect(selectSkills('search-library', 'A5').map((item) => item.id)).toContain('skill-local-library');
    expect(selectSkills('take-assessment', 'A5').map((item) => item.id)).toContain('skill-authentic-assessment');
  });

  it('selects the V0.9 behavior-design skill', () => {
    expect(selectSkills('design-habit', 'A5').map((item) => item.id)).toContain('skill-tiny-habits');
    expect(selectSkills('behavior-diagnose', 'A5').map((item) => item.id)).toContain('skill-tiny-habits');
  });
});
