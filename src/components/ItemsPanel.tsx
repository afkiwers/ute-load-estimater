import type { LoadItem } from '../model/types';
import type { ItemEffect } from '../model/calc';
import { num, signedKg } from '../model/format';
import { trailerName } from '../model/trailers';
import { useStore } from '../state/store';
import { useResult, useSetup } from '../state/result';
import { useUi } from '../state/ui';

export function effectText(item: LoadItem, e: ItemEffect | undefined): string {
  if (!e) return '';
  const short = (v: number) => signedKg(v).replace(' kg', '');
  const ute = e.ute.fl + e.ute.fr + e.ute.rl + e.ute.rr;
  const van = e.caravan.ball + e.caravan.left + e.caravan.right;
  const parts: string[] = [];
  if (Math.abs(ute) > 0.5 || item.host === 'ute' || item.measured?.host === 'ute') {
    parts.push(`front ${short(e.ute.fl + e.ute.fr)}, rear ${short(e.ute.rl + e.ute.rr)}`);
  }
  if (Math.abs(van) > 0.5 || item.host === 'caravan') {
    parts.push(`ball ${short(e.caravan.ball)}, trailer axles ${short(e.caravan.left + e.caravan.right)}`);
  }
  return parts.join(' · ');
}

function Row({ item, effect }: { item: LoadItem; effect: ItemEffect | undefined }) {
  const selectedId = useUi((s) => s.selectedId);
  const update = useStore((s) => s.update);
  return (
    <div
      className={`item-row${item.id === selectedId ? ' selected' : ''}${item.enabled ? '' : ' disabled'}`}
      onClick={() => useUi.getState().select(item.id)}
    >
      <input
        type="checkbox"
        checked={item.enabled}
        title="Include in the scenario"
        onClick={(e) => e.stopPropagation()}
        onChange={(e) =>
          update((s) => {
            const it = s.items.find((i) => i.id === item.id);
            if (it) it.enabled = e.target.checked;
          })
        }
      />
      <span className="swatch" style={{ width: 12, height: 12, borderRadius: 3, background: item.color, border: '1px solid rgb(0 0 0 / .15)' }} />
      <div style={{ minWidth: 0 }}>
        <div className="item-name">
          {item.name}
          {item.measured && <span className="badge">weighed</span>}
        </div>
        <div className="item-sub">{effectText(item, effect) || '–'}</div>
      </div>
      <div className="item-mass">{num(item.mass)} kg</div>
    </div>
  );
}

export function ItemsPanel() {
  const setup = useSetup();
  const result = useResult();
  const update = useStore((s) => s.update);
  const groups: { title: string; items: LoadItem[] }[] = [
    { title: 'On the ute', items: setup.items.filter((i) => i.host === 'ute') },
    {
      title: setup.towing ? `In / on the ${trailerName(setup.caravan.kind)}` : `${trailerName(setup.caravan.kind, true)} (towing is off)`,
      items: setup.items.filter((i) => i.host === 'caravan'),
    },
  ];
  const added = setup.items.filter((i) => i.enabled && !i.measured).reduce((a, i) => a + i.mass, 0);
  const removed = setup.items.filter((i) => !i.enabled && i.measured).reduce((a, i) => a + i.mass, 0);

  return (
    <div className="tab-body">
      <p className="section-note">
        Untick an item to leave it out. Items marked <span className="badge" style={{ marginLeft: 0 }}>weighed</span> were on the
        vehicle when you weighed it, so they are already inside the readings: they only change the result when you move or untick them.
      </p>
      <div className="stat-grid" style={{ marginBottom: 12 }}>
        <div className="stat">
          <div className="k">Added on top of the readings</div>
          <div className="v">{num(added)} kg</div>
        </div>
        <div className="stat">
          <div className="k">Weighed items taken off</div>
          <div className="v">{num(removed)} kg</div>
        </div>
      </div>
      {groups.map((g) => (
        <div key={g.title}>
          <div className="check-group-title">{g.title}</div>
          {g.items.length === 0 && <div className="empty">Nothing yet. Drag items from the left onto the 3D view.</div>}
          {g.items.map((it) => (
            <Row key={it.id} item={it} effect={result.itemEffects[it.id]} />
          ))}
        </div>
      ))}
      <div className="btn-row" style={{ marginTop: 14 }}>
        <button
          className="btn"
          title="Use this right after weighing: everything currently ticked was on the vehicle."
          onClick={() =>
            update((s) => {
              for (const it of s.items) it.measured = it.enabled ? { host: it.host, pos: { ...it.pos } } : null;
            })
          }
        >
          Mark ticked items as weighed
        </button>
        <button className="btn" onClick={() => update((s) => s.items.forEach((it) => (it.measured = null)))}>
          Clear weighed marks
        </button>
        <button
          className="btn danger"
          disabled={!setup.items.length}
          onClick={() => {
            if (confirm('Remove all items from this setup?')) update((s) => void (s.items = []));
          }}
        >
          Remove all
        </button>
      </div>
    </div>
  );
}
