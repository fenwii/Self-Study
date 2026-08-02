import { describe, expect, it } from 'vitest';
import { routeIntent } from '../src/main/agents/intent-router';

describe('natural language intent router', () => {
  it('routes long-term learning goals', () => {
    expect(routeIntent('我想在三个月内学会TypeScript')).toBe('create-goal');
  });

  it('routes practice and verification requests', () => {
    expect(routeIntent('给我一个实战练习')).toBe('practice');
    expect(routeIntent('考考我是否真正掌握')).toBe('take-assessment');
  });

  it('routes focus sessions, review, artifacts and knowledge maps', () => {
    expect(routeIntent('开始25分钟专注学习')).toBe('start-session');
    expect(routeIntent('今天复习什么')).toBe('review');
    expect(routeIntent('帮我创建一个可验收作品')).toBe('create-artifact');
    expect(routeIntent('展示我的知识图谱')).toBe('show-knowledge');
  });
});
