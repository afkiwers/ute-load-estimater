import { useEffect, useState } from 'react';
import { overallStatus } from './model/calc';
import type { Setup } from './model/types';
import { decodeSetup, sharePayload } from './share';
import { useStore } from './state/store';
import { useResult } from './state/result';
import { NARROW, paletteDefault, useUi, type Tab } from './state/ui';
import { TopBar } from './components/TopBar';
import { Palette } from './components/Palette';
import { Viewport } from './components/Viewport';
import { ResultsPanel } from './components/ResultsPanel';
import { UtePanel } from './components/UtePanel';
import { TowingPanel } from './components/TowingPanel';
import { ItemsPanel } from './components/ItemsPanel';
import { Report } from './components/Report';
import { deleteItem, duplicateItem } from './components/Inspector';
import { SharedSetupDialog } from './components/ShareDialog';

const DOT: Record<string, string> = {
  ok: 'var(--ok)',
  near: 'var(--near)',
  warn: 'var(--near)',
  over: 'var(--over)',
  unset: 'var(--unset)',
};

function SidePanel() {
  const tab = useUi((s) => s.tab);
  const setTab = useUi((s) => s.setTab);
  const result = useResult();
  const itemCount = useStore((s) => s.setups[s.activeId].items.length);
  const issueLevel = (prefix: string) =>
    result.issues.some((i) => i.level !== 'info' && i.fields?.some((f) => f.startsWith(prefix))) ? DOT.warn : null;
  const tabs: { id: Tab; label: string; dot?: string | null }[] = [
    { id: 'results', label: 'Results', dot: DOT[overallStatus(result)] },
    { id: 'ute', label: 'Ute', dot: issueLevel('uteReadings') },
    { id: 'towing', label: 'Towing', dot: issueLevel('caravanReadings') },
    { id: 'items', label: `Items (${itemCount})` },
  ];
  return (
    <aside className="side">
      <nav className="tabs">
        {tabs.map((t) => (
          <button key={t.id} className={`tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
            {t.dot && <span className="dot" style={{ background: t.dot }} />}
            {t.label}
          </button>
        ))}
      </nav>
      {tab === 'results' && <ResultsPanel />}
      {tab === 'ute' && <UtePanel />}
      {tab === 'towing' && <TowingPanel />}
      {tab === 'items' && <ItemsPanel />}
    </aside>
  );
}

function Toast() {
  const toast = useUi((s) => s.toast);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => useUi.setState({ toast: null }), 2800);
    return () => clearTimeout(t);
  }, [toast]);
  return toast ? (
    <div className="toast" key={toast.nonce}>
      {toast.text}
    </div>
  ) : null;
}

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest('input, textarea, select, [contenteditable="true"]')) return;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      const store = useStore.getState();
      const selected = useUi.getState().selectedId;
      if (mod && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) store.redo();
        else store.undo();
      } else if (mod && key === 'y') {
        e.preventDefault();
        store.redo();
      } else if (mod && key === 'd' && selected) {
        e.preventDefault();
        duplicateItem(selected);
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selected) {
        e.preventDefault();
        deleteItem(selected);
      } else if (e.key === 'Escape') {
        useUi.getState().select(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/** Crossing the drawer width switches the items list to that size's default. */
function usePaletteFollowsWidth() {
  useEffect(() => {
    const mq = matchMedia(NARROW);
    const onChange = () => useUi.setState({ paletteOpen: paletteDefault() });
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
}

/** A setup opened from a share link ("#s=..."). The link is taken out of the address so a reload doesn't ask again. */
function useSharedSetup(): [Setup | null, () => void] {
  const [shared, setShared] = useState<Setup | null>(null);
  useEffect(() => {
    const check = () => {
      const payload = sharePayload(location.hash);
      if (!payload) return;
      try {
        history.replaceState(null, '', location.pathname + location.search);
      } catch {
        location.hash = '';
      }
      decodeSetup(payload).then(setShared, () =>
        useUi.getState().showToast("This share link is incomplete or damaged, so there's nothing to add. Ask for it again."),
      );
    };
    check();
    window.addEventListener('hashchange', check);
    return () => window.removeEventListener('hashchange', check);
  }, []);
  return [shared, () => setShared(null)];
}

export function App() {
  useShortcuts();
  usePaletteFollowsWidth();
  const paletteOpen = useUi((s) => s.paletteOpen);
  const [shared, closeShared] = useSharedSetup();
  return (
    <div className="app">
      <TopBar />
      <main className={`main ${paletteOpen ? 'palette-open' : 'palette-closed'}`}>
        {paletteOpen && <div className="palette-backdrop" onClick={() => useUi.getState().setPaletteOpen(false)} />}
        <Palette />
        <Viewport />
        <SidePanel />
      </main>
      <Toast />
      <Report />
      {shared && <SharedSetupDialog setup={shared} onClose={closeShared} />}
    </div>
  );
}
