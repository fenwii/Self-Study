import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('V0.7 visual and accessibility contracts', () => {
  it('ships persisted themes, typography, density and reading width', () => {
    const pkg = JSON.parse(read('package.json')) as { version: string };
    const app = read('src/app/App.tsx');
    const settings = read('src/app/components/SettingsModal.tsx');
    const styles = read('src/app/styles.css');
    expect(Number(pkg.version.split('.')[1])).toBeGreaterThanOrEqual(7);
    expect(app).toContain('data-reading-width');
    expect(app).toContain('data-high-contrast');
    expect(app).toContain('skip-link');
    expect(settings).toContain('外观与阅读');
    expect(settings).toContain('减少动态效果');
    expect(styles).toContain('--reading-width');
    expect(styles).toContain(':focus-visible');
    expect(styles).toContain('prefers-reduced-motion');
  });

  it('keeps primary and secondary text above WCAG AA contrast', () => {
    expect(contrast('#17191c', '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#565c64', '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#707781', '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#f2f3f4', '#191b1d')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#b6bbc1', '#191b1d')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#f1fff6', '#285c3b')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#10230f', '#95ec69')).toBeGreaterThanOrEqual(4.5);
  });
});

function contrast(foreground: string, background: string): number {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

function luminance(value: string): number {
  const channels = [1, 3, 5].map((index) => Number.parseInt(value.slice(index, index + 2), 16) / 255)
    .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}
