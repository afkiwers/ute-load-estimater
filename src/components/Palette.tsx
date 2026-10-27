import { useState } from 'react';
import { ITEM_TEMPLATES, itemFromTemplate, uid, type ItemTemplate } from '../model/presets';
import { trailerName } from '../model/trailers';
import { activeSetup, useStore } from '../state/store';
import { isNarrow, useUi } from '../state/ui';

/** The template being dragged from the palette; dataTransfer can't be read during dragover. */
export const paletteDrag: { current: ItemTemplate | null } = { current: null };

export function addTemplate(tpl: ItemTemplate) {
  const setup = activeSetup();
  const item = itemFromTemplate(tpl, setup);
  useStore.getState().update((s) => void s.items.push(item));
  useUi.getState().select(item.id);
  // As a drawer the list covers the view; get it out of the way to show the new item.
  if (isNarrow()) useUi.getState().setPaletteOpen(false);
  if (item.host === 'caravan' && !setup.towing) useUi.getState().showToast(`Added to the ${trailerName(setup.caravan.kind)}, but towing is switched off (Towing tab).`);
}

function TemplateChip({ tpl, onRemove }: { tpl: ItemTemplate; onRemove?: () => void }) {
  return (
    <div
      className="tpl"
      draggable
      title={`${tpl.name}, ${tpl.mass} kg. Drag onto the vehicle, or click + to add it at its usual spot.${tpl.note ? ` ${tpl.note}` : ''}`}
      onDragStart={(e) => {
        paletteDrag.current = tpl;
        e.dataTransfer.setData('text/plain', tpl.id);
        e.dataTransfer.effectAllowed = 'copy';
      }}
      onDragEnd={() => {
        paletteDrag.current = null;
        useUi.getState().setDropPreview(null);
      }}
      onDoubleClick={() => addTemplate(tpl)}
    >
      <span className="swatch" style={{ background: tpl.color }} />
      <span className="tpl-name">{tpl.name}</span>
      <span className="tpl-mass num">{tpl.mass} kg</span>
      {onRemove && (
        <button className="icon-btn" title="Remove from palette" onClick={onRemove}>
          ×
        </button>
      )}
      <button className="icon-btn" title="Add at its usual spot" onClick={() => addTemplate(tpl)}>
        +
      </button>
    </div>
  );
}

function CustomForm() {
  const add = useStore((s) => s.addCustomTemplate);
  const [name, setName] = useState('');
  const [mass, setMass] = useState('');
  const [l, setL] = useState('400');
  const [w, setW] = useState('400');
  const [h, setH] = useState('300');
  const [color, setColor] = useState('#8a6d4b');
  const m = Number(mass);
  const valid = name.trim() !== '' && m > 0 && Number(l) > 0 && Number(w) > 0 && Number(h) > 0;
  return (
    <form
      className="custom-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        add({
          id: `custom-${uid()}`,
          category: 'My items',
          name: name.trim(),
          mass: m,
          size: { l: Number(l), w: Number(w), h: Number(h) },
          shape: 'box',
          color,
          anchor: 'tub',
        });
        setName('');
        setMass('');
      }}
    >
      <div className="row">
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} title="Colour" />
        <input placeholder="Name, e.g. My winch" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="row">
        <label>
          Mass kg
          <input inputMode="decimal" value={mass} onChange={(e) => setMass(e.target.value)} placeholder="38.5" />
        </label>
        <label>
          L mm
          <input inputMode="numeric" value={l} onChange={(e) => setL(e.target.value)} />
        </label>
        <label>
          W mm
          <input inputMode="numeric" value={w} onChange={(e) => setW(e.target.value)} />
        </label>
        <label>
          H mm
          <input inputMode="numeric" value={h} onChange={(e) => setH(e.target.value)} />
        </label>
      </div>
      <button className="btn primary" type="submit" disabled={!valid}>
        Add to palette
      </button>
    </form>
  );
}

export function Palette() {
  const custom = useStore((s) => s.customTemplates);
  const remove = useStore((s) => s.removeCustomTemplate);
  const [showForm, setShowForm] = useState(false);
  const towing = useStore((s) => s.setups[s.activeId].towing);
  const kind = useStore((s) => s.setups[s.activeId].caravan.kind);
  // Trailer items only for the trailer being towed; ute items always.
  const templates = ITEM_TEMPLATES.filter((t) => !t.kinds || (towing && t.kinds.includes(kind)));
  const categories = [...new Set(templates.map((t) => t.category))];
  return (
    <aside className="palette" aria-label="Items">
      <div className="panel-title palette-head">
        Items
        <button className="icon-btn" title="Hide the items list" aria-label="Hide the items list" onClick={() => useUi.getState().setPaletteOpen(false)}>
          «
        </button>
      </div>
      <p className="palette-hint">
        <span className="only-mouse">Drag onto the ute or trailer in the 3D view. Change the mass and position afterwards.</span>
        <span className="only-touch">Tap + to add an item at its usual spot, then change its mass and position.</span>
      </p>

      <div className="panel-title" style={{ display: 'flex', alignItems: 'center' }}>
        My items
        <button className="icon-btn" style={{ marginLeft: 'auto' }} title="Create an item" onClick={() => setShowForm((v) => !v)}>
          {showForm ? '−' : '+'}
        </button>
      </div>
      {showForm && <CustomForm />}
      {custom.length === 0 && !showForm && (
        <p className="palette-hint" style={{ marginBottom: 0 }}>
          Use + to create your own item with its exact weight.
        </p>
      )}
      {custom.map((t) => (
        <TemplateChip key={t.id} tpl={t} onRemove={() => remove(t.id)} />
      ))}

      {categories.map((cat) => (
        <div key={cat}>
          <div className="panel-title">{cat}</div>
          {templates.filter((t) => t.category === cat).map((t) => (
            <TemplateChip key={t.id} tpl={t} />
          ))}
        </div>
      ))}
    </aside>
  );
}
