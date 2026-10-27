import type { ReactNode } from 'react';
import { capacityAt } from '../model/calc';
import { kg, mm, num } from '../model/format';
import { uid } from '../model/presets';
import { axleCentre } from '../model/geometry';
import type { ItemShape, LoadItem } from '../model/types';
import { useStore } from '../state/store';
import { useResult, useSetup } from '../state/result';
import { useUi } from '../state/ui';
import { NumInput } from './fields';
import { effectText } from './ItemsPanel';

export function duplicateItem(id: string) {
  const store = useStore.getState();
  const newId = uid();
  store.update((s) => {
    const it = s.items.find((i) => i.id === id);
    if (!it) return;
    const copy: LoadItem = structuredClone(it);
    copy.id = newId;
    copy.measured = null;
    copy.pos = { ...copy.pos, y: copy.pos.y + Math.min(400, copy.size.w + 20) };
    s.items.push(copy);
  });
  useUi.getState().select(newId);
}

export function deleteItem(id: string) {
  useStore.getState().update((s) => void (s.items = s.items.filter((i) => i.id !== id)));
  useUi.getState().select(null);
}

function Labeled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

export function Inspector() {
  const id = useUi((s) => s.selectedId);
  const setup = useSetup();
  const result = useResult();
  const update = useStore((s) => s.update);
  const item = setup.items.find((i) => i.id === id);
  if (!item) return null;

  const edit = (key: string, fn: (it: LoadItem) => void) =>
    update(
      (s) => {
        const it = s.items.find((i) => i.id === item.id);
        if (it) fn(it);
      },
      { history: `item:${item.id}:${key}` },
    );

  const isUte = item.host === 'ute';
  const L = setup.ute.wheelbase;
  const relRear = item.pos.x - L;
  const vanAxles = axleCentre(setup.caravan);
  const where = isUte
    ? item.pos.x < 0
      ? `${mm(-item.pos.x)} ahead of the front axle`
      : relRear > 0
        ? `${mm(relRear)} behind the rear axle`
        : `between the axles, ${mm(-relRear)} ahead of the rear axle`
    : `${mm(Math.abs(item.pos.x - vanAxles))} ${item.pos.x > vanAxles ? 'behind' : 'ahead of'} ${setup.caravan.axles.length > 1 ? 'the centre of the caravan axles' : 'the caravan axle'}`;
  const m = item.measured;
  const moved = m && (m.host !== item.host || Math.hypot(m.pos.x - item.pos.x, m.pos.y - item.pos.y, m.pos.z - item.pos.z) > 5);
  const ignored = item.host === 'caravan' && !setup.towing;
  const cap = ignored ? null : capacityAt(setup, item.host, item.pos, result);

  return (
    <div className="inspector" onPointerDown={(e) => e.stopPropagation()}>
      <div className="inspector-head">
        <input type="color" value={item.color} onChange={(e) => edit('color', (it) => (it.color = e.target.value))} title="Colour" />
        <input className="title" value={item.name} onChange={(e) => edit('name', (it) => (it.name = e.target.value))} aria-label="Item name" />
        <button className="icon-btn" title="Close (Esc)" onClick={() => useUi.getState().select(null)}>
          ×
        </button>
      </div>
      <div className="inspector-body">
        <div className="fields">
          <Labeled label="Mass">
            <NumInput value={item.mass} unit="kg" nullable={false} min={0} onChange={(v) => edit('mass', (it) => (it.mass = v ?? 0))} />
          </Labeled>
          <Labeled label="Shape">
            <span className="field-input">
              <select value={item.shape} onChange={(e) => edit('shape', (it) => (it.shape = e.target.value as ItemShape))}>
                <option value="box">Box</option>
                <option value="cylinder">Cylinder</option>
                <option value="person">Person</option>
                <option value="bullbar">Bull bar</option>
              </select>
            </span>
          </Labeled>
        </div>

        <div>
          <div className="field-label" style={{ marginBottom: 3 }}>Centre of mass ({isUte ? 'from the front axle' : 'from the coupling'})</div>
          <div className="fields" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
            <Labeled label={isUte ? 'Behind front axle' : 'Behind coupling'}>
              <NumInput value={item.pos.x} unit="mm" nullable={false} onChange={(v) => edit('x', (it) => (it.pos.x = v ?? 0))} />
            </Labeled>
            <Labeled label="Right of centre">
              <NumInput value={item.pos.y} unit="mm" nullable={false} onChange={(v) => edit('y', (it) => (it.pos.y = v ?? 0))} />
            </Labeled>
            <Labeled label="Height">
              <NumInput value={item.pos.z} unit="mm" nullable={false} onChange={(v) => edit('z', (it) => (it.pos.z = v ?? 0))} />
            </Labeled>
          </div>
          <div className="field-hint" style={{ marginTop: 3 }}>
            {where}. Negative "right" is the left (passenger) side.
          </div>
        </div>

        <div>
          <div className="field-label" style={{ marginBottom: 3 }}>Size (length × width × height)</div>
          <div className="fields" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
            <NumInput value={item.size.l} unit="mm" nullable={false} min={10} onChange={(v) => edit('l', (it) => (it.size.l = v ?? it.size.l))} ariaLabel="Length" />
            <NumInput value={item.size.w} unit="mm" nullable={false} min={10} onChange={(v) => edit('w', (it) => (it.size.w = v ?? it.size.w))} ariaLabel="Width" />
            <NumInput value={item.size.h} unit="mm" nullable={false} min={10} onChange={(v) => edit('h', (it) => (it.size.h = v ?? it.size.h))} ariaLabel="Height" />
          </div>
        </div>

        <div>
          <label className="toggle">
            <input type="checkbox" checked={item.enabled} onChange={(e) => edit('enabled', (it) => (it.enabled = e.target.checked))} />
            Include in this scenario
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={Boolean(item.measured)}
              onChange={(e) => edit('measured', (it) => (it.measured = e.target.checked ? { host: it.host, pos: { ...it.pos } } : null))}
            />
            Was on the vehicle when weighed (here)
          </label>
        </div>

        {moved && (
          <div className="callout">
            Moved since weighing: its load comes off at the weighed spot (wireframe) and goes on here.{' '}
            <button className="btn" style={{ marginTop: 6 }} onClick={() =>
                edit('reset', (it) => {
                  if (!it.measured) return;
                  it.host = it.measured.host;
                  it.pos = { ...it.measured.pos };
                })
              }>
              Put back
            </button>
          </div>
        )}

        {ignored ? (
          <div className="callout">Towing is off, so caravan items carry no load.</div>
        ) : (
          <>
            <div className="callout">
              Effect on the result: <b>{effectText(item, result.itemEffects[item.id]) || 'none'}</b>
              {item.measured && !moved && item.enabled && <> (already in the readings)</>}
            </div>
            {cap && (
              <div className="callout accent">
                {cap.kg === Infinity ? (
                  'No rated limit would be reached by adding more here. Enter the limits to check.'
                ) : cap.kg <= 0 ? (
                  <>
                    Nothing more fits here: <b>{cap.limitedBy}</b> is already at or over its limit.
                  </>
                ) : (
                  <>
                    Room for about <b>{kg(cap.kg)}</b> more at this spot before the <b>{cap.limitedBy}</b> limit.
                  </>
                )}
              </div>
            )}
          </>
        )}

        <div className="btn-row">
          <button className="btn" onClick={() => duplicateItem(item.id)} title="Ctrl+D">
            Duplicate
          </button>
          <button className="btn danger" onClick={() => deleteItem(item.id)} title="Delete key">
            Delete
          </button>
          <span className="field-hint" style={{ marginLeft: 'auto', alignSelf: 'center' }}>
            {num(item.mass)} kg on the {item.host}
          </span>
        </div>
      </div>
    </div>
  );
}
