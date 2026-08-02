import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useAppStore } from './store';
import { Sidebar } from './components/Sidebar';
import { ChatPanel } from './components/ChatPanel';
import { Inspector } from './components/Inspector';
import { SettingsModal } from './components/SettingsModal';

export function App() {
  const initialize = useAppStore((state) => state.initialize);
  const loading = useAppStore((state) => state.loading);
  const dashboard = useAppStore((state) => state.dashboard);
  const inspectorOpen = useAppStore((state) => state.inspectorOpen);
  const focusMode = useAppStore((state) => state.focusMode);
  const selectGoal = useAppStore((state) => state.selectGoal);
  const setSettingsOpen = useAppStore((state) => state.setSettingsOpen);
  const setInspectorOpen = useAppStore((state) => state.setInspectorOpen);
  const setFocusMode = useAppStore((state) => state.setFocusMode);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!media) return;
    const listener = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey;
      if (modifier && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        selectGoal(dashboard?.goals.find((g) => g.status === 'active')?.id);
      }
      if (modifier && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent('self-study:focus-goal-search'));
      }
      if (modifier && event.key === ',') {
        event.preventDefault();
        setSettingsOpen(true);
      }
      if (modifier && event.shiftKey && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        setFocusMode(!focusMode);
      }
      if (event.key === 'Escape') {
        if (focusMode) setFocusMode(false);
        else if (inspectorOpen) setInspectorOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusMode, inspectorOpen, selectGoal, dashboard, setFocusMode, setInspectorOpen, setSettingsOpen]);

  const appearance = dashboard?.appearance ?? {
    theme: 'system' as const,
    fontScale: 1,
    density: 'comfortable' as const,
    readingWidth: 'standard' as const,
    reduceMotion: false,
    highContrast: false
  };
  const resolvedTheme = appearance.theme === 'system' ? (systemDark ? 'dark' : 'light') : appearance.theme;
  const className = [
    'app-shell',
    focusMode ? 'focus-mode' : '',
    inspectorOpen && !focusMode ? 'inspector-open' : 'inspector-closed'
  ].filter(Boolean).join(' ');
  const style = useMemo(() => ({ '--font-scale': String(appearance.fontScale) }) as CSSProperties, [appearance.fontScale]);

  return (
    <div
      className={className}
      data-theme={resolvedTheme}
      data-density={appearance.density}
      data-reading-width={appearance.readingWidth}
      data-reduce-motion={appearance.reduceMotion ? 'true' : 'false'}
      data-high-contrast={appearance.highContrast ? 'true' : 'false'}
      style={style}
    >
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      {loading && <div className="loading-line" aria-label="正在加载" />}
      {!focusMode && <Sidebar />}
      <ChatPanel />
      {inspectorOpen && !focusMode && <Inspector />}
      <SettingsModal />
    </div>
  );
}
