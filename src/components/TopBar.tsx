import { useRef, useState } from 'react';
import type { Setup } from '../model/types';
import { BUILD, versionLabel } from '../build';
import { useStore } from '../state/store';
import { sceneBridge, useUi } from '../state/ui';
import { AboutDialog } from './AboutDialog';
import { ShareIcon } from './clipboard';
import { ShareDialog } from './ShareDialog';

function download(name: string, text: string) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function parseImport(text: string): Setup[] {
  const data = JSON.parse(text);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.setups)) return data.setups;
  if (data?.ute && data?.items) return [data];
  throw new Error('Not an export from this tool.');
}

export function printReport() {
  const ui = useUi.getState();
  ui.select(null);
  // Let the deselect render before grabbing the 3D view.
  requestAnimationFrame(() => {
    ui.setSnapshot(sceneBridge.current?.snapshot() ?? '');
    setTimeout(() => window.print(), 150);
  });
}

export function TopBar() {
  const { setups, order, activeId, selectSetup, createSetup, duplicateSetup, renameSetup, deleteSetup, importSetups, undo, redo } = useStore();
  const canUndo = useStore((s) => s.history.past.length > 0);
  const canRedo = useStore((s) => s.history.future.length > 0);
  const fileRef = useRef<HTMLInputElement>(null);
  const [about, setAbout] = useState(false);
  const [sharing, setSharing] = useState(false);
  const paletteOpen = useUi((s) => s.paletteOpen);
  const active = setups[activeId];

  return (
    <header className="topbar">
      <button
        className="tb-btn tb-icon"
        onClick={() => useUi.getState().setPaletteOpen(!paletteOpen)}
        title={paletteOpen ? 'Hide the items list' : 'Show the items list'}
        aria-label={paletteOpen ? 'Hide the items list' : 'Show the items list'}
        aria-expanded={paletteOpen}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M9 4v16" />
        </svg>
      </button>
      <div className="brand">
        <span className="brand-mark">U</span>
        <span className="brand-text">Ute Load Estimator</span>
      </div>
      <select value={activeId} onChange={(e) => selectSetup(e.target.value)} aria-label="Setup">
        {order.map((id) => (
          <option key={id} value={id}>
            {setups[id].name}
          </option>
        ))}
      </select>
      <div className="tb-actions">
        <input className="name" value={active.name} onChange={(e) => renameSetup(e.target.value)} aria-label="Setup name" />
        <button className="tb-btn" onClick={() => createSetup()} title="New setup from the preset">
          New
        </button>
        <button className="tb-btn" onClick={duplicateSetup} title="Copy this setup, e.g. to compare loading plans">
          Duplicate
        </button>
        <button
          className="tb-btn"
          onClick={() => {
            if (confirm(`Delete the setup "${active.name}"?`)) deleteSetup();
          }}
        >
          Delete
        </button>
        <span className="tb-sep" />
        <button className="tb-btn" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
          Undo
        </button>
        <button className="tb-btn" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">
          Redo
        </button>
        <span className="spacer" />
        <button className="tb-btn tb-share" onClick={() => setSharing(true)} title="Send this setup to someone as a link">
          <ShareIcon /> Share
        </button>
        <button
          className="tb-btn"
          title="Save all setups to a file"
          onClick={() => {
            const data = { app: 'ute-load-estimator', version: 1, exportedAt: new Date().toISOString(), setups: order.map((id) => setups[id]) };
            download(`ute-load-setups-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2));
          }}
        >
          Export
        </button>
        <button className="tb-btn" onClick={() => fileRef.current?.click()} title="Load setups from an exported file">
          Import
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            try {
              const n = importSetups(parseImport(await file.text()));
              useUi.getState().showToast(`Imported ${n} setup${n === 1 ? '' : 's'}.`);
            } catch (err) {
              useUi.getState().showToast(`Import failed: ${(err as Error).message}`);
            }
          }}
        />
        <button className="tb-btn primary" onClick={printReport} title="Printable summary (save as PDF from the print dialog)">
          Report
        </button>
      </div>
      <button className="tb-btn tb-version" onClick={() => setAbout(true)} title="Version and build information">
        {versionLabel(BUILD)}
      </button>
      {about && <AboutDialog onClose={() => setAbout(false)} />}
      {sharing && <ShareDialog onClose={() => setSharing(false)} />}
    </header>
  );
}
