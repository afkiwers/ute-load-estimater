import { useState, type DragEvent } from 'react';
import type { Check } from '../model/calc';
import { num, pct } from '../model/format';
import { itemFromTemplate } from '../model/presets';
import { placeFromHit } from '../model/geometry';
import { activeSetup, useStore } from '../state/store';
import { useResult } from '../state/result';
import { labelLayer, sceneBridge, useUi, type ViewPreset } from '../state/ui';
import { Scene } from '../three/Scene';
import { Inspector } from './Inspector';
import { paletteDrag } from './Palette';
import { STATUS_TEXT } from './ResultsPanel';

const GAUGES: { id: string; label: string }[] = [
  { id: 'gvm', label: 'GVM' },
  { id: 'frontAxle', label: 'Front axle' },
  { id: 'rearAxle', label: 'Rear axle' },
  { id: 'payload', label: 'Payload' },
  { id: 'towCapacity', label: 'Towing cap.' },
  { id: 'towBall', label: 'Ball' },
  { id: 'gcm', label: 'GCM' },
  { id: 'atm', label: 'ATM' },
  { id: 'gtm', label: 'GTM' },
];

function Gauge({ c, label }: { c: Check; label: string }) {
  const has = c.limit != null && c.limit > 0;
  const frac = has ? Math.min(1, c.value / (c.limit as number)) : 0;
  const color = c.status === 'over' ? 'var(--over)' : c.status === 'near' ? 'var(--near)' : c.status === 'unset' ? 'var(--unset)' : 'var(--ok)';
  return (
    <button className={`gauge ${c.status}`} onClick={() => useUi.getState().setTab('results')} title={`${c.label}: ${STATUS_TEXT[c.status]}`}>
      <div className="g-label">
        <span>{label}</span>
        <span>{has ? pct((c.value / (c.limit as number)) * 100) : '–'}</span>
      </div>
      <div className="g-value">
        {num(c.value)}
        <span className="lim">{has ? ` / ${num(c.limit as number)}` : ''} kg</span>
      </div>
      <div className="bar" style={{ marginTop: 3, height: 4 }}>
        <div className="bar-fill" style={{ width: `${frac * 100}%`, background: color }} />
      </div>
    </button>
  );
}

function SummaryStrip() {
  const result = useResult();
  return (
    <div className="strip">
      {GAUGES.map((g) => {
        const c = result.checks.find((x) => x.id === g.id);
        return c ? <Gauge key={g.id} c={c} label={g.label} /> : null;
      })}
    </div>
  );
}

const VIEWS: { id: ViewPreset; label: string }[] = [
  { id: 'iso', label: '3/4' },
  { id: 'side', label: 'Side' },
  { id: 'top', label: 'Top' },
  { id: 'front', label: 'Front' },
  { id: 'rear', label: 'Rear' },
];

function ViewToolbar() {
  const view = useUi((s) => s.view.preset);
  const xray = useUi((s) => s.xray);
  const labels = useUi((s) => s.labels);
  const towing = useStore((s) => s.setups[s.activeId].towing);
  const ui = useUi.getState();
  return (
    <div className="view-toolbar">
      <div className="grp">
        {VIEWS.map((v) => (
          <button key={v.id} className={view === v.id ? 'on' : ''} onClick={() => ui.setView(v.id)}>
            {v.label}
          </button>
        ))}
      </div>
      {towing && (
        <div className="grp">
          <button className={view === 'ute' ? 'on' : ''} onClick={() => ui.setView('ute')}>
            Ute
          </button>
          <button className={view === 'caravan' ? 'on' : ''} onClick={() => ui.setView('caravan')}>
            Trailer
          </button>
        </div>
      )}
      <div className="grp">
        <button className={labels ? 'on' : ''} onClick={() => ui.setLabels(!labels)} title="Wheel loads and dimensions">
          Labels
        </button>
        <button className={xray ? 'on' : ''} onClick={() => ui.setXray(!xray)} title="See through the body and roofs to place items inside the cab or trailer">
          X-ray
        </button>
      </div>
    </div>
  );
}

export function Viewport() {
  const [dropActive, setDropActive] = useState(false);

  const previewAt = (e: DragEvent) => {
    const tpl = paletteDrag.current;
    if (!tpl) return null;
    const hit = sceneBridge.current?.pick(e.clientX, e.clientY);
    return hit ? { tpl, placement: placeFromHit(tpl, hit, activeSetup()) } : { tpl, placement: null };
  };

  const onDragOver = (e: DragEvent) => {
    if (!paletteDrag.current) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDropActive(true);
    const p = previewAt(e);
    const ui = useUi.getState();
    if (p?.placement) ui.setDropPreview({ ...p.placement, size: p.tpl.size, shape: p.tpl.shape, color: p.tpl.color });
    else ui.setDropPreview(null);
  };

  const onDragLeave = (e: DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setDropActive(false);
    useUi.getState().setDropPreview(null);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDropActive(false);
    const ui = useUi.getState();
    ui.setDropPreview(null);
    const p = previewAt(e);
    paletteDrag.current = null;
    if (!p) return;
    if (!p.placement) {
      ui.showToast('Drop it onto the ute or the trailer.');
      return;
    }
    const setup = activeSetup();
    const item = itemFromTemplate(p.tpl, setup);
    item.host = p.placement.host;
    item.pos = p.placement.pos;
    useStore.getState().update((s) => void s.items.push(item));
    ui.select(item.id);
  };

  return (
    <section className="viewport">
      <SummaryStrip />
      <div className={`canvas-wrap${dropActive ? ' drop-active' : ''}`} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
        <div className="label-layer" ref={(el) => void (labelLayer.current = el)} />
        <Scene />
        <ViewToolbar />
        <div className="view-hint">Drag items to move them · left-drag to orbit · right-drag to pan · scroll to zoom</div>
        <Inspector />
      </div>
    </section>
  );
}
